# 16 — Contributor guide

## Why

The repository has a small public API but a dense delivery system. New
contributors need one friendly entry point that says what to change where and
which rules the gates enforce, without reading the full element set first.
`AGENTS.md` covers automated contributors; `CONTRIBUTING.md` covers humans.

## How to use

Read `CONTRIBUTING.md` before your first change. It names the prerequisites
(`git`, `bash`, `make`, rootless Podman), the discovery commands (`make help`,
`make verify`, `make docs-preview`), a change-to-location table, the rules the
gates enforce and the public-API/schema policy — and links to the published
[development page](https://pboueke.github.io/canto-data/development/) for the
target map, support matrix and release process rather than restating them.

## Authority

`CONTRIBUTING.md` is guidance, not enforcement: the gates in `make verify` are
the truth, and `AGENTS.md` remains the contract agents are held to. It
introduces no new command surface, restates no gate definition, and is not part
of the published package (npm ships only its always-included files). When the
guide and a gate disagree, fix the guide.

## How to replace

Keep it short and factual; prefer a pointer to the enforcing element document or
the published development page over duplicating a rule. If contribution flow
changes, update this document, the element row in `docs/elements/README.md` and
the README's development pointer in the same change.
