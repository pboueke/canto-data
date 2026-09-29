# 02 — Verification gates

## Why

Contributors need one reproducible interface that either passes completely or
fails visibly. `make verify` is that interface: it composes the smallest set of
independent gates that together cover formatting, static analysis, types,
coverage, compilation and shell behaviour.

## How to use

```bash
make verify          # every required gate, in dependency order
make fmt-check       # formatting only
make lint            # ESLint
make types           # strict tsc over source and tests
make test            # Jest with 100% coverage floors
make build           # CommonJS output + declarations
make shellcheck      # ShellCheck over all shell scripts
```

- Each target is a thin wrapper over an npm script or a pinned tool run. npm
  scripts are leaf commands; gate composition lives here.
- Coverage floors are enforced by Jest configuration, not by this Makefile, so
  a different runner cannot silently lower them.
- `make verify` is the only supported aggregate; CI and the pre-push hook call
  it instead of re-listing gates.

## Authority

`toolkit/mk/gates.mk` owns gate composition. Jest owns coverage thresholds. ESLint
owns lint policy. No CI workflow or hook may redefine these gates.

## How to replace

Change a leaf command in `package.json` and only its Make wrapper; the target
name is the stable interface. If a new gate is added, wire it into `verify` and
document the failure mode it introduces. Do not add a gate that cannot fail
non-zero.
