# Contributing to canto-data

Thanks for helping. `canto-data` is a small MIT-licensed TypeScript library that
ships with a reproducible verification toolkit and a published documentation
site. [AGENTS.md](AGENTS.md) is the same working agreement for automated
contributors.

## Prerequisites

- `git`, `bash` and `make`
- a rootless Podman runtime

Every gate runs inside digest-pinned rootless containers. Host
`node`/`npm`/`npx` runs are convenient for quick checks but are never gate
evidence.

## Get started

```bash
git clone https://github.com/pboueke/canto-data.git
cd canto-data
make verify     # the authoritative gate
```

The full target map, support matrix and release process live on the published
[development page](https://pboueke.github.io/canto-data/development/). Locally,
`make help` is the discoverable map of targets and element documents, and
`make docs-preview` serves the documentation site at
`http://127.0.0.1:4321/canto-data/`.

## What to change and where

| Change                 | Where                                                         | Then                                                                    |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Library behavior/types | `src/`                                                        | add tests, keep 100% coverage, update contract fixtures on API change   |
| Verification tooling   | `toolkit/tools/lib` + `toolkit/tools/__tests__`, `toolkit/mk` | add a unit test per new branch; shell stays ShellCheck-clean            |
| Contract fixtures      | `toolkit/fixtures/contract/*.json`                            | `make contract-check` matches them against the built public API         |
| Documentation site     | `docs/page/src/content/docs/`                                 | `make docs-build` verifies routes, links, assets and the version marker |
| Element documentation  | `docs/elements/`                                              | change the element document together with the element                   |
| Product summary        | `README.md`                                                   | README stays a summary; the site is the full reference (spec `001/D27`) |
| Release notes          | `CHANGELOG.md`                                                | typed notes drive `make version-check`                                  |

## Rules the gates enforce

- **100% coverage** — statements, branches, functions and lines, with no ignore
  pragmas, baselines or reduced floors.
- **No tracked-file writes** — verification may write ignored output
  (`.cache/`, `coverage/`, `dist/`) but never versions, badges, the Git index or
  Git configuration.
- **Explicit synchronization** — `make version-sync` and `make badges-sync`
  write; their `-check` counterparts only verify, and hooks never stage.
- **One gate definition** — npm scripts are leaf commands used by Make; do not
  add a competing gate in CI, hooks or scripts.
- **Append-only decisions** — spec decisions are cited as `NNN/D<n>`; record a
  deviation as a new decision instead of silently weakening a gate.

## Public API and schema changes

The public surface is the root export plus the `/types`, `/format`, `/version`,
`/validation` and `/migration` subpaths. Changing it means updating the
committed fixtures so `make contract-check` still matches. Schema changes follow
semver (breaking = MAJOR, new optional field = MINOR, docs or validation fix =
PATCH) and migrations stay forward-only and additive. `pack-check` and `audit`
fail closed: never ship forbidden paths, and never add an advisory exception
without an `advisoryId`, a reason and an expiry.

Versioning and release steps are documented once, on the
[development page](https://pboueke.github.io/canto-data/development/).
Publishing is owner-run and interactive; see that page for the exact commands.

## Getting help

`make help`, [docs/elements/README.md](docs/elements/README.md) and the
[development page](https://pboueke.github.io/canto-data/development/).
