# Implementation evidence — 001 adopt reproducible library development

Local implementation is complete on top of the spec-only approval commit
`b1eb33da45e5ca02d6ac4a413765e9ad4a1f5933`. No commits, pushes, tags or
publishes were made by the agent (001/D17). Verification tooling is grouped
under `toolkit/` (001/D21); element docs stay in `docs/elements/`. This
document separates **confirmed local evidence** from **owner-gated claims**;
the spec stays active until the gated evidence exists.

## Confirmed local evidence

`make verify` exits `0` with the host `node`/`npm` removed from `PATH`
(`PATH=/usr/bin:/bin`; host requirements are git, bash, make and rootless
Podman only):

- final run log: `.cache/canto-data/reports/verify-final.log` (gitignored);
- post-restructure run (001/D21): `.cache/canto-data/reports/verify-restructure.log`;
- post-release-script run (001/D22): `.cache/canto-data/reports/verify-release-script.log`;
- post-tag-workflow run (001/D23): `.cache/canto-data/reports/verify-tag-workflow.log`;
- post-Carranca-removal run (001/D24): `.cache/canto-data/reports/verify-no-carranca.log`;
- post-merge run incorporating the upstream 1.1.0/1.2.0 line (001/D25):
  `.cache/canto-data/reports/verify-merge-1.2.0.log`;
- patch-release run with the `v1.2.1` entry (001/D25):
  `.cache/canto-data/reports/verify-v1.2.1.log`;
- docs-site run (001/D26): `.cache/canto-data/reports/verify-docs-site.log`;
- docs-content run reaching README parity: `.cache/canto-data/reports/verify-docs-content.log`;
- README-summary run (001/D27): `.cache/canto-data/reports/verify-readme-summary.log`;
- clean bootstrap: `node_modules`, `dist` and `coverage` were deleted first and
  `npm ci --ignore-scripts --no-audit --no-fund` ran inside the pinned
  toolkit — `.cache/canto-data/reports/verify-clean-path.log`;
- tracked files are unchanged by verification: SHA-1 snapshots of every
  tracked file present in the worktree are byte-identical before and after
  the final run.

| Gate                    | Result                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make fmt-check`        | all maintained TS/JS, JSON, Markdown and YAML formatted                                                                                                                                  |
| `make lint`             | ESLint 10 + typescript-eslint clean                                                                                                                                                      |
| `make types`            | strict `tsc` over source and tests clean                                                                                                                                                 |
| `make test`             | 23 suites, 441 tests, **100% statements, branches, functions, lines**                                                                                                                    |
| `make build`            | CommonJS output and declarations compile                                                                                                                                                 |
| `make contract-check`   | 44 committed fixtures match the built public API                                                                                                                                         |
| `make integration`      | installed-tarball migration/validation/attachments/serialization/manifest lifecycle passes with a controlled clock                                                                       |
| `make consumer-test`    | Node 18, 20, 22 and 24: CJS, ESM interop, `node`/`node16`/`bundler` declarations, negative diagnostics                                                                                   |
| `make browser-consumer` | 7 checks pass in real headless Chromium; failure propagation proven for unavailable browser, failing assertion and broken package entry                                                  |
| `make audit`            | no HIGH/CRITICAL locked dependency without a valid exception (graph upgraded to zero findings)                                                                                           |
| `make version-check`    | changelog, package, both lockfile fields and README agree; bump validated against typed notes since the base                                                                             |
| `make badges-check`     | README badges match machine-readable Jest reports (441/441, 100%)                                                                                                                        |
| `make docs-build`       | 10 Starlight pages build in the toolkit; version marker, local-only assets and every internal link verify under `/canto-data/` (the README is a short summary pointing at them, 001/D27) |
| `make shellcheck`       | every shell script (`release.sh`, `.githooks/`, `toolkit/`, `.github/`) clean under the pinned ShellCheck image                                                                          |

Pinned runtime evidence: toolkit Node `v24.21.0`; fixtures run against
`dist/index.js`; tarball inspection reports 43 files, zero runtime
dependencies, `sha256 f7b82a3befde1fe6644d13e17341dab8dc5c9c95d5195b2f19c6199193dc0ce1`
(`canto-data-1.2.1.tgz`). npm always ships `package/README.md`, so the
README simplification (001/D27) is part of these bytes; this supersedes the
`5215529a…` digest of the pre-summary package.

### Upstream integration (001/D25)

`git merge origin/main` (`b659c70`, the 1.1.0/1.2.0 line) produced merge commit
`e538bc7`. `git diff origin/main -- src/` reports only the added
`src/__tests__/index.test.ts`, so the upstream source is incorporated
byte-for-byte. The contract tool gained operations for
`validateChunkedAttachmentContent`, `isChunkedAttachmentContentGuard` and
`guardAndValidateChunkedAttachmentContent`; `migration.json` now covers
`0.16.0`→`0.19.0`, both no-op hops, `0.19.0` pass-through and `0.20.0`
rejection; `chunked-content.json` adds 13 cases; `attachments.json` covers
descriptor carry-through and rewrite omission; `installed.js`, the consumer
scripts and the index barrel test were moved to `0.19.0`.

### Failure demonstrations (all non-zero, fail closed)

- **Version drift**: `make version-check` reported all four carriers at 1.0.4
  against a 1.0.5 changelog top, then `make version-sync` repaired them.
- **Bump mismatch**: a temporary repository with a patch release carrying
  `- feat:` notes failed with “applies a patch bump but its typed notes require
  minor”.
- **Untested file**: adding `src/untested-probe.ts` failed `make test` on the
  statements/lines/functions thresholds; removing it restored 100%.
- **Contract drift / missing fixtures**: a deliberately wrong fixture failed
  with the fixture name and actual error; a missing fixture directory failed
  with `fixture directory ... does not exist`.
- **Badges without reports**: removing `coverage/jest-results.json` and
  `coverage-summary.json` failed `make badges-check` with “run make test
  first”.
- **Audit fail-closed**: running the audit without a lockfile failed with
  `npm audit failed: This command requires an existing lockfile.` (ENOLOCK);
  expired exceptions are covered by unit tests and never grant cover.
- **Browser faults**: `make browser-consumer` itself fails non-zero if the
  browser is unavailable, an in-page assertion fails or the package entry
  point is broken.
- **Release guard**: a candidate at 1.2.0 (equal to the registry’s published
  `latest`) is refused because it is not ahead of the registry, so the guard
  is exercised without publishing. The owner-run `release.sh` is covered by 11 stub-driven tests
  (tag handling including annotated tags, dirty worktree, `origin/main`
  containment, manifest validation, registry duplicate/head/error guards,
  missing or mismatched candidate, checksum and repack mismatches, and a
  non-interactive `--publish` refusal that reaches no tool). Live guards:
  `./release.sh --check` exits 1 in this uncommitted worktree at the worktree
  guard, `./release.sh --publish` without a TTY exits 1 before any tool runs,
  and `./release.sh --help` prints the two modes.
- **Hooks**: unit tests plus real-git tests cover install, idempotency,
  conflict refusal (`--force true` owner action), partial-staging rejection,
  staged-content formatting checks and shell-hook exit propagation;
  `make hooks-install` was dogfooded in this clone (`core.hooksPath=.githooks`).

### Objective checklist

| Requirement                                                         | Evidence                                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Digest-pinned rootless-Podman Node 24 toolkit                       | `toolkit/mk/toolkit.mk`, `toolkit/Containerfile`; image label verified against the pin                                 |
| Root Makefile map with required targets                             | `make help`; `toolkit/mk/*.mk` fragments each link an element doc                                                      |
| Absolute 100% coverage including `src/index.ts` and tooling helpers | `make test`; new-file probe fails                                                                                      |
| Fail-closed audit with expiring exceptions                          | `toolkit/tools/lib/audit.js`, `toolkit/tools/audit/exceptions.json`, tests and live ENOLOCK demo                       |
| Synthetic contract fixtures                                         | `toolkit/fixtures/contract/*.json`, 44 cases including the new chunked-content operations, drift/missing demos         |
| Installed-tarball CJS/ESM/types/Node matrix                         | `make consumer-test`, Node 18/20/22/24                                                                                 |
| Integration lifecycle with controlled clock                         | `make integration`                                                                                                     |
| Real headless Chromium bundler gate                                 | `make browser-consumer`                                                                                                |
| Version/lockfile/README-badge sync + drift failure                  | `make version-check`/`version-sync`, demos                                                                             |
| Machine-checked badges                                              | `make badges-check`/`badges-sync` from Jest JSON reports                                                               |
| Opt-in `.githooks` replacing Husky/lint-staged                      | `.githooks`, `toolkit/tools/lib/hooks.js`; Husky/lint-staged removed from manifest, lockfile and tree                  |
| Automatic release tags                                              | `.github/workflows/release-tag.yml`; tag-only, version-check gated, never moves or publishes                           |
| CI aligned to `make verify` with pinned actions                     | `.github/workflows/ci.yml`                                                                                             |
| Owner-triggered exact-tarball release                               | `release.sh` (`--check` default, `--publish` interactive); publish workflow removed; `prepublishOnly: make verify`     |
| GitHub Pages docs site                                              | `docs/page/` Starlight project; `make docs-build`; `.github/workflows/pages.yml` deploys only the verified `dist`      |
| README as summary only (001/D27)                                    | badges + install + quick start + documentation index; full reference lives on the site (`docs/page/src/content/docs/`) |
| Verification never mutates tracked files                            | hash snapshots before/after, identical                                                                                 |
| Public API, MIT, zero runtime deps, schema/manifest separation      | upstream `src/` incorporated byte-for-byte (`git diff origin/main -- src/`); `pack-check`, license/name checks         |

## Owner-gated or unavailable

- **GitHub Actions results** for this revision require the owner to commit,
  push and open/refresh the PR; agents do not push. CI is prepared to run the
  same `make verify` from a fresh checkout, and the tag-only workflow is
  prepared to tag the released version.
- **Pages deployment** needs the owner to select `GitHub Actions` as the Pages
  source once in repository settings (the workflow holds only the granted
  Pages token and deploys exactly the verified `docs/page/dist`).
- **Publication** is not required for acceptance and remains owner-triggered:
  `./release.sh --check`, then `./release.sh --publish` with npm's second
  factor.
- **Spec archive** is deferred until the CI evidence above exists.

## Release state

The changelog now carries `## v1.2.1 - Reproducible verification toolkit` as a
patch release over the upstream `1.2.0` line, and every carrier
(`package.json`, both lockfile fields, README badge) agrees on `1.2.1`.
`release.sh` therefore accepts the candidate: after the change reaches `main`
the tag-only workflow creates `v1.2.1`, then `./release.sh --check` verifies the
tagged commit and `./release.sh --publish` publishes it interactively. If the
tag workflow is unavailable, create the tag manually with the `v` prefix — the
existing upstream tags are `v1.1.0` and `1.2.0`.

## Workspace state for the owner

The worktree contains the implementation, uncommitted **on top of merge commit
`e538bc7`** (local `b1eb33d` merged with `origin/main` `b659c70`; README and
`package-lock.json` were resolved by hand, lock taking the toolkit dependency
graph plus the upstream `1.2.0` version fields): new guidance, `toolkit/`
(container, Make fragments, tooling helpers with tests, fixtures), element
documentation, hooks and workflows; modified
`package.json`/lockfile/README/Jest/tsconfig/`.gitignore`/spec formatting; and
the removal of Husky, lint-staged, `scripts/verify-repo.sh`, `publish.yml`,
`.github/carranca/` and `pr-review.yml` (staged deletions via `git rm`). The
owner reviews and commits; `npm run verify:repo` is a thin `make verify`
delegate.
