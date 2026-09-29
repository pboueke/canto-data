# 12 — Owner-run release

## Why

Publishing used to follow every version change pushed to `main`, and later ran
in CI. npm now demands a second factor for every publish, so a token-based
non-interactive publish is no longer an acceptable path, and a merge must never
be a release. Publishing is an explicit owner action, and the check that
precedes it must be runnable without credentials.

## How to use

Release preparation stays manual and happens in a normal change:

1. Add the new `## vX.Y.Z - description` entry with typed notes.
2. `make version-sync` and, after `make test`, `make badges-sync`.
3. The owner reviews and merges to `main` (agents never do this). The
   tag-only workflow then pushes `vX.Y.Z` once, provided the repository's own
   version check passes, the tag is absent and `main` has not advanced. If the
   tag is missing (for example the workflow was disabled), create it manually:
   `git tag vX.Y.Z && git push origin vX.Y.Z`.

Then, from a clean checkout at the tagged commit:

1. `./release.sh --check` (the default) verifies that the remote tag exists and
   identifies `HEAD`, that `HEAD` is on `origin/main`, that the version is
   unpublished and ahead of the registry's `latest`, runs
   `make verify VERSION_BASE=origin/main`, packs the tarball, stages it as
   `.release/canto-data-X.Y.Z.tgz` with `SHA256SUMS`, and proves its SHA-256
   matches a fresh pack of the tagged checkout inside a disposable container.
   It never publishes, and it never overwrites a different staged artifact.
2. `./release.sh --publish` repeats every check, requires an interactive
   terminal, keeps npm credentials in `~/.config/canto-data/npm` (mode 0700,
   outside the repository), runs `npm login` and `whoami` in the pinned
   toolkit so npm can prompt for the second factor, and publishes only after
   the owner types `publish canto-data@X.Y.Z`.

`.release/` is gitignored. Provenance attestations are a CI feature and are not
claimed for owner-run publishes; the compensating control is that the published
bytes are the exact bytes the staged checksum and a fresh repack agree on.

## Authority

`release.sh` owns publishing. No workflow holds publish credentials and no
workflow publishes. Tags are created once by `.github/workflows/release-tag.yml`
when the version reaches `main`; the workflow never moves an existing tag and
never publishes, and `release.sh` still refuses to publish unless the tag
identifies the checkout. `package.json` `prepublishOnly: make verify` still
gates an accidental local `npm publish`, and the script publishes the prebuilt
tarball with `--ignore-scripts` because the gate already verified those bytes.

## How to replace

Swap the publish step for another registry or a trusted-publishing flow without
weakening the contract: verify the tagged `main` revision, verify the version
against the registry, run the full gate, prove the artifact matches a fresh
pack, publish exactly those bytes, fail on duplicates and backwards versions,
and keep credentials out of the repository and out of every non-interactive
path.
