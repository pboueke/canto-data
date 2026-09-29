# toolkit

Reproducible verification and delivery tooling for `canto-data`. Everything here
runs inside digest-pinned rootless Podman containers; the host only needs `git`,
`bash`, `make` and a rootless Podman runtime. Host `node`/`npm` runs are never
gate evidence.

## Layout

| Path                          | What it is                                             |
| ----------------------------- | ------------------------------------------------------ |
| `Containerfile`               | the pinned toolkit image (Node 24 + locked tooling)    |
| `mk/*.mk`                     | Make fragments, one per element with a command surface |
| `tools/cli/run.js`            | command entry point used by the Make targets           |
| `tools/lib/`                  | one dependency-injected module per command             |
| `tools/__tests__/`            | Jest suites covering every `tools/lib` branch          |
| `tools/audit/exceptions.json` | reviewed HIGH/CRITICAL advisory exceptions             |
| `fixtures/contract/`          | committed synthetic fixtures for the public API        |

## Using it

Always go through `make`:

```bash
make help            # targets and element documents
make verify          # every gate: the authoritative check
make contract-check  # a single gate
```

The root `Makefile` includes the `mk/*.mk` fragments; npm scripts in
`package.json` are leaf commands used by Make, not a second gate definition.

## Links

- [docs/elements/README.md](../docs/elements/README.md) — why each element
  exists, how to use it and how to replace it
- [docs/elements/01-toolkit.md](../docs/elements/01-toolkit.md) — the pinned
  toolkit image
- [docs/elements/02-gates.md](../docs/elements/02-gates.md) — the gate map
- [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md) —
  contributor and agent working agreements
- [Development and verification](https://pboueke.github.io/canto-data/development/)
  — the published target table, support matrix and release steps
