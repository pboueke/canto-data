---
title: Development and verification
description: How canto-data is verified, supported and released.
---

Verification runs in pinned, rootless Podman containers; the host only needs
`git`, `bash`, `make` and a rootless Podman runtime. Host `node`/`npm` runs are
never gate evidence.

```bash
make help     # discoverable map of targets and element documents
make verify   # the authoritative gate (runs every check below)
```

| Target                                     | What it proves                                                    |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `make preflight`                           | a usable rootless Podman runtime and writable caches              |
| `make toolkit-build`                       | the pinned Node 24 toolkit image matches its digest               |
| `make fmt-check`                           | maintained TS/JS, JSON, Markdown and YAML are formatted           |
| `make lint`                                | ESLint over maintained source and executable helpers              |
| `make types`                               | strict TypeScript checks including tests                          |
| `make test`                                | the Jest suite at 100% statements, branches, functions and lines  |
| `make build`                               | the CommonJS distribution and declarations compile                |
| `make contract-check`                      | committed synthetic fixtures match the public API                 |
| `make integration`                         | the installed tarball drives migration, validation and export     |
| `make consumer-test`                       | Node 18/20/22/24 CJS, ESM, declarations and negative diagnostics  |
| `make browser-consumer`                    | the installed package bundles and runs in headless Chromium       |
| `make docs-build`                          | the Starlight site builds and every page, link and asset verifies |
| `make docs-preview`                        | the built site is served locally for review                       |
| `make audit`                               | no HIGH/CRITICAL locked dependencies without a reviewed exception |
| `make version-check` / `make version-sync` | changelog, package, lockfile and README agree                     |
| `make badges-check` / `make badges-sync`   | README badges match machine-readable reports                      |
| `make hooks-install`                       | the opt-in repository-local `.githooks` are installed             |

Every element has a document under
[docs/elements](https://github.com/pboueke/canto-data/tree/main/docs/elements)
explaining why it exists, how to use it and how to replace it.
[AGENTS.md](https://github.com/pboueke/canto-data/blob/main/AGENTS.md) states
the working agreement for automated changes, including the 100% coverage floor
and the rule that agents never commit, tag or publish.
[CONTRIBUTING.md](https://github.com/pboueke/canto-data/blob/main/CONTRIBUTING.md)
is the human entry point: prerequisites, what to change where and the gate
rules, linking back to this page for the target map and release steps.

Verification may write ignored build/test output, but never tracked files,
versions, badges, the Git index or Git configuration. Synchronization is
explicit: `make version-sync` and `make badges-sync` write, their `-check`
counterparts only verify, and hooks never stage anything.

## Support matrix

| Runtime                       | What is exercised                                                             |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Node `>=18` (published floor) | packaged consumer tests on Node 18, 20 and 22                                 |
| Node 24                       | the pinned toolkit and the packaged consumer tests on Node 24                 |
| CommonJS                      | the root export and every runtime subpath                                     |
| Node ESM interop              | named imports from the CommonJS distribution; no native ESM output is claimed |
| TypeScript                    | declarations under `node`, `node16` and `bundler` module resolution           |
| Browsers                      | the installed package bundled with esbuild and run in real headless Chromium  |

## Release process

`CHANGELOG.md` is the authored release version. To prepare a release:

1. add a `## vX.Y.Z - description` entry with typed notes (`breaking`, `feat`,
   `fix`, `chore`, `docs`, `ci`, `test`);
2. run `make version-sync` and, after `make test`, `make badges-sync`;
3. review and merge to `main`; the tag workflow pushes `vX.Y.Z` once the
   version reaches `main` (if the tag is missing, create it manually with
   `git tag vX.Y.Z && git push origin vX.Y.Z`).

Publishing is owner-run and interactive because npm now requires a second
factor for every publish:

- `./release.sh --check` verifies the tagged `main` revision, runs the full
  gate, stages `.release/canto-data-X.Y.Z.tgz` with `SHA256SUMS` and proves the
  bytes match a fresh pack; it never publishes.
- `./release.sh --publish` repeats those checks, logs in to npm inside the
  pinned toolkit (credentials live in `~/.config/canto-data/npm`) and publishes
  only after you type `publish canto-data@X.Y.Z`.

No workflow holds publish credentials, and tagging stays with the owner.
