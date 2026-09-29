# Element documentation

Each adoption element is one piece of the verification and delivery system.
Every document states **why** the element exists, **how** to use it, what its
**authority** is (what it owns, and what it must not duplicate) and **how to
replace** it if the project outgrows it.

The root `Makefile` is the discoverable index: it includes one `toolkit/mk/*.mk`
fragment per element that has a command surface, and `make help` lists both the
targets and the element documents.

| Element                     | Document                                     | Command surface                                          |
| --------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Pinned toolkit              | [01-toolkit.md](01-toolkit.md)               | `make preflight`, `make toolkit-build`, `make deps`      |
| Verification gates          | [02-gates.md](02-gates.md)                   | `make fmt-check lint types test build shellcheck verify` |
| Contract fixtures           | [03-contracts.md](03-contracts.md)           | `make contract-check`                                    |
| Installed-package consumers | [04-consumers.md](04-consumers.md)           | `make consumer-test`                                     |
| Integration lifecycle       | [05-integration.md](05-integration.md)       | `make integration`                                       |
| Browser consumer            | [06-browser.md](06-browser.md)               | `make browser-consumer`                                  |
| Dependency audit            | [07-audit.md](07-audit.md)                   | `make audit`                                             |
| Version authority           | [08-versioning.md](08-versioning.md)         | `make version-check version-sync`                        |
| Badge evidence              | [09-badges.md](09-badges.md)                 | `make badges-check badges-sync`                          |
| Git hooks                   | [10-hooks.md](10-hooks.md)                   | `make hooks-install`, `.githooks/*`                      |
| Continuous integration      | [11-ci.md](11-ci.md)                         | `.github/workflows/ci.yml`, `release-tag.yml`            |
| Owner-triggered release     | [12-release.md](12-release.md)               | `./release.sh`                                           |
| Agent guidance              | [13-agent-guidance.md](13-agent-guidance.md) | `AGENTS.md`                                              |
| Spec workflow               | [14-spec-workflow.md](14-spec-workflow.md)   | `docs/spec/`                                             |
| GitHub Pages docs           | [15-pages.md](15-pages.md)                   | `make docs-build docs-preview`                           |
| Contributor guide           | [16-contributing.md](16-contributing.md)     | `CONTRIBUTING.md`                                        |

One authority per concern: the Makefile owns the gate composition, npm scripts
remain leaf commands, the changelog owns the release version, and no element
introduces a second source of truth for any of them.
