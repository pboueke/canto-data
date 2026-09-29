#!/usr/bin/env bash
# Owner-operated npm release. The default is check-only; only --publish can
# reach npm's publish endpoint, and that path requires a typed confirmation
# because npm now demands a second factor for every publish.
set -euo pipefail

usage() {
  printf '%s\n' 'Usage: ./release.sh [--check|--publish]' \
    '  --check    Verify the tagged commit and stage .release/ (default; no publish).' \
    '  --publish  Verify, log in to npmjs.org and publish after typed confirmation.'
}

fail() {
  printf 'release: %s\n' "$1" >&2
  exit 1
}

if (($# > 1)); then
  usage >&2
  exit 2
fi
mode="${1:---check}"
case "$mode" in
--check) ;;
--publish)
  [[ -t 0 && -t 1 ]] || fail 'publishing requires an interactive terminal'
  ;;
--help | -h)
  usage
  exit 0
  ;;
*)
  usage >&2
  exit 2
  ;;
esac

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
for command in git make podman; do
  command -v "$command" >/dev/null 2>&1 || fail "missing $command"
done
[[ -z "$(git status --porcelain)" ]] || fail 'commit or remove worktree changes before releasing'

image='canto-data-toolkit:1'
npm_cache="$root/.cache/canto-data/npm"
mkdir -p -- "$npm_cache"

# Everything that needs Node or npm runs in the pinned toolkit; the host only
# needs git, make and rootless Podman. The checkout is writable because the
# gate builds dist/, coverage/ and the pack cache here.
toolkit() {
  podman run --rm --userns=keep-id --user "$(id -u):$(id -g)" \
    --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/cache/npm \
    -v "$root":/work -v "$npm_cache":/cache/npm -w /work "$image" "$@"
}

make preflight toolkit-build

version="$(toolkit node -e '
const {readFileSync}=require("node:fs");
const pkg=JSON.parse(readFileSync("package.json","utf8"));
if (pkg.name!=="canto-data" || pkg.private===true ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version)) process.exit(1);
console.log(pkg.version);
')" || fail 'manifest is not a publishable canto-data package'

head="$(git rev-parse HEAD)"
tag="v$version"
remote_tag="$(git ls-remote --exit-code origin "refs/tags/$tag" "refs/tags/$tag^{}")" ||
  fail "remote $tag tag is missing; create and push it first: git tag $tag && git push origin $tag"
# Annotated tags expose both the tag object and the peeled commit, so accept
# either line; a lightweight tag exposes only the commit.
if ! printf '%s\n' "$remote_tag" | cut -f1 | grep -qx "$head"; then
  fail "$tag does not identify this checkout ($head)"
fi

git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
git merge-base --is-ancestor "$head" refs/remotes/origin/main ||
  fail "$head is not on origin/main; merge the release commit before releasing"

latest="$(toolkit npm view canto-data version 2>/dev/null)" ||
  fail 'could not read the published version; refusing to publish blind'
[[ -n "$latest" ]] || fail 'the registry reported no published version'
if toolkit npm view "canto-data@$version" version >/dev/null 2>&1; then
  fail "canto-data@$version is already published"
fi
higher="$(printf '%s\n%s\n' "$latest" "$version" | sort -V | tail -n1)"
[[ "$higher" == "$version" ]] ||
  fail "registry latest is $latest; candidate $version is not ahead of it. Reconcile the release history first."

make verify VERSION_BASE=origin/main
make pack

candidate=".cache/canto-data/pack/canto-data-$version.tgz"
[[ -f "$candidate" ]] || fail "missing $candidate; run make pack"
artifact=".release/canto-data-$version.tgz"
checksums='.release/SHA256SUMS'
mkdir -p -- .release

candidate_line="$(toolkit sha256sum "$candidate")"
expected_sha="${candidate_line%% *}"
[[ "$expected_sha" =~ ^[0-9a-f]{64}$ ]] || fail "could not checksum $candidate"
if [[ -f "$artifact" ]]; then
  staged_line="$(toolkit sha256sum "$artifact")"
  [[ "${staged_line%% *}" == "$expected_sha" ]] ||
    fail "staged $artifact differs from the packed candidate; remove it deliberately to regenerate"
else
  cp -- "$candidate" "$artifact"
fi
printf '%s  %s\n' "$expected_sha" "$artifact" >"$checksums"

# Rebuild the tarball from the tagged checkout alone and compare bytes with the
# staged candidate. The reference pack stays in a disposable container, and the
# staged artifact is never overwritten.
# shellcheck disable=SC2016 # ${CANTODATA_VERSION} expands inside the container.
repacked="$(podman run --rm --userns=keep-id --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e CANTODATA_VERSION="$version" \
  -v "$root":/work:ro -w /work "$image" bash -lc '
    set -euo pipefail
    npm pack --ignore-scripts --pack-destination /tmp --json >/tmp/pack.json
    sha256sum "/tmp/canto-data-${CANTODATA_VERSION}.tgz"
  ')" || fail 'could not repack the tagged checkout'
repacked_sha="${repacked%% *}"
[[ "$repacked_sha" == "$expected_sha" ]] ||
  fail 'candidate differs from a fresh pack of the tagged checkout; do not publish it'
printf 'release: verified %s at %s (SHA-256 %s)\n' "$artifact" "$tag" "$expected_sha"

if [[ "$mode" == --check ]]; then
  printf '%s\n' 'release: check-only; nothing was published'
  exit 0
fi

# npm credentials live outside the repository and the ephemeral toolkit image.
# `npm login` and `npm publish` run with a TTY so npm can prompt for the second
# factor it now requires for every publish. Provenance attestations are a CI
# feature and are not available to an owner-run publish.
auth_dir="${XDG_CONFIG_HOME:-$HOME/.config}/canto-data/npm"
mkdir -p -- "$auth_dir"
chmod 700 -- "$auth_dir"
npm_toolkit() {
  podman run --rm -it --userns=keep-id --user "$(id -u):$(id -g)" \
    -v "$root":/work:ro -v "$auth_dir":/npm-auth:Z \
    -e NPM_CONFIG_USERCONFIG=/npm-auth/.npmrc -e HOME=/tmp \
    -w /work "$image" npm "$@"
}

npm_toolkit login --registry=https://registry.npmjs.org/
npm_toolkit whoami --registry=https://registry.npmjs.org/
printf 'Type "publish canto-data@%s" to publish %s: ' "$version" "$artifact"
read -r confirmation
[[ "$confirmation" == "publish canto-data@$version" ]] || fail 'publication cancelled'
npm_toolkit publish "./$artifact" --ignore-scripts --registry=https://registry.npmjs.org/
printf 'release: published canto-data@%s; verify the registry and a disposable install\n' "$version"
