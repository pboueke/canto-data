# 01 — Pinned rootless-Podman toolkit

## Why

A gate that depends on the host's Node, npm or editor toolchain proves nothing
about what CI runs and breaks the moment a reviewer has a different runtime.
The toolkit runs every check in a container whose base image is pinned by
multi-arch digest, with frozen `npm ci`, so two machines executing `make verify`
execute the same bytes.

## How to use

```bash
make preflight       # requires rootless Podman; fails on root or unusable runtime
make toolkit-build   # builds canto-data-toolkit:1 from the pinned Node 24 digest
make deps            # frozen npm ci inside the toolkit, host-user file ownership
```

- `toolkit/mk/toolkit.mk` holds the image digests and the single `TOOLKIT_RUN`
  definition; every fragment uses it rather than calling Podman itself.
- Host requirements for all gates are `git`, `bash`, `make` and rootless
  Podman only. Host node/npm/npx runs are never gate evidence.
- The npm cache lives in `.cache/canto-data/npm` (gitignored), mounted at
  `/cache/npm`; build output stays in the checkout and is written as the host
  user through `--userns=keep-id --user $(id -u):$(id -g)`.
- Companion images are pinned next to the toolkit: Node 18/20/22 for packaged
  consumers, the Playwright image for the browser gate and the ShellCheck image
  for shell logic.
- Verification tooling is grouped under `toolkit/`: the container at
  `toolkit/Containerfile`, the Make fragments at `toolkit/mk/*.mk`, the
  executable helpers at `toolkit/tools/**` and the synthetic fixtures at
  `toolkit/fixtures/**` (001/D21). Element documentation stays in
  `docs/elements/`.

## Authority

Only this element chooses runtimes and image pins. `toolkit/Containerfile`
is the only Dockerfile; no gate builds its own private container.

## How to replace

Upgrade deliberately: pull the new tag, resolve its **index** digest, update it
here and in `toolkit/Containerfile`, then run `make verify`. To move
off Podman, replace `TOOLKIT_RUN` and `preflight` with an equivalent
digest-pinned runner; do not let individual targets grow their own runner.
