# AGENTS.md

Working agreement for automated contributors to `canto-data`. This file is
portable: it names no workstation paths, no agent-specific configuration and no
sibling checkout. It is documentation for agents and humans, not runtime
enforcement.

## Project identity

`canto-data` is an MIT-licensed TypeScript library with **zero runtime
dependencies** for Canto journal data portability. It ships CommonJS output and
declarations for Node `>=18`. Preserve the package name, license, changelog
history and the public API, including the root export and the `/types`,
`/format`, `/version`, `/validation` and `/migration` subpaths.

## Command authority

`make` is the only supported gate interface. Run `make help` for the map.

- `make verify` is authoritative. It runs every required gate inside pinned,
  rootless Podman containers: formatting, lint, strict types, 100% coverage
  tests, build, contract fixtures, installed-tarball consumers, integration,
  browser checks and dependency audit.
- Host requirements are `git`, `bash`, `make` and rootless Podman. Do **not**
  treat host `node`/`npm`/`npx` runs, IDE output or editor plugins as gate
  evidence.
- npm scripts are leaf commands used by Make. Do not add a second, competing
  gate definition in CI, hooks or scripts.

## Coverage floor

- 100% statements, branches, functions and lines over all maintained production
  TS/JS, including `src/index.ts` and executable tooling helpers.
- No coverage-ignore pragmas, grandfather baselines, silent skips or reduced
  floors. An added untested file must fail verification.
- Shell hooks, installers and orchestration behavior are tested behaviorally,
  including failure paths, and shell scripts are ShellCheck-clean.

## Spec-first workflow

- Specifications live in `docs/spec/active/NNN-slug/spec.md`; see
  `docs/spec/README.md` for the conventions.
- Do not implement an unapproved spec. Approval is the spec-only merge or an
  owner's explicit solo spec-only approval commit.
- Decisions are append-only and cited as `NNN/D<n>`. Record necessary
  deviations from an approved spec as new decisions in the implementation
  change instead of silently weakening a gate.
- Archive a spec only with real completion evidence.

## History, release and destructive operations

- Agents do not commit, push, tag, revert or publish. The owner owns Git
  history, tags and npm releases.
- Never run `npm publish`, `gh release create`, `git tag`, `git push` or
  history rewrites.
- Publishing is the owner-run, interactive `./release.sh` (`--check` first):
  it requires a typed confirmation and npm's second factor. No workflow or
  agent may bypass it.
- Ask the owner for explicit confirmation before any destructive operation:
  forced resets or checkouts, rewrites of history, deletion of unignored files,
  or cache removal outside `.cache/`, `coverage/` and `dist/`.
- Verification may write ignored build/test output. It must never modify
  tracked files, versions, badges, the Git index or Git configuration.

## Element documentation

Every adoption element has a document in `docs/elements/` that explains why it
exists, how to use it and how to replace it. Change the element document with
the element. See `docs/elements/README.md` for the index.
