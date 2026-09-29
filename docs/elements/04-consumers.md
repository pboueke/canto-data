# 04 — Installed-package consumers

## Why

A green test suite in the checkout does not prove that the tarball people
install actually works. This element packs the built library, installs the
tarball in disposable consumers **outside** the repository, and exercises the
public entry points on every supported Node runtime.

## How to use

```bash
make pack          # npm pack --ignore-scripts into .cache/canto-data/pack
make pack-check    # tarball contents, identity, license and runtime deps
make consumer-test # Node 18/20/22/24: CJS, ESM, declarations, negatives
```

- Consumers never resolve repository sources or path aliases: the tarball is
  installed into a `mktemp -d` directory outside the checkout, and each Node
  runtime runs a pinned image by digest.
- CJS and Node-ESM consumers exercise the root export and every runtime
  subpath. ESM checks interoperation with the CommonJS distribution; no native
  ESM output is claimed.
- Positive TypeScript consumers check declarations under `node`, `node16` and
  `bundler` module resolution, including a type-only import from
  `canto-data/types`.
- Negative TypeScript consumers must produce type errors (TS2322/TS2739); a
  missing-module failure (TS2307) is treated as a harness failure.
- `pack-check` rejects repository-only files (source, tests, CI, hooks,
  fixtures, tools, lockfile), missing runtime files or declarations, identity
  changes and any runtime dependency.

## Authority

`toolkit/mk/consumers.mk` owns tarball packing and consumer orchestration;
`toolkit/tools/lib/installed.js` and `toolkit/tools/lib/pack.js` own the checks. Coverage
measurement stays with Jest — consumers assert behaviour, not coverage.

## How to replace

Change the runtime matrix by updating the pinned image digests in
`toolkit/mk/toolkit.mk`. If the package ever ships native ESM, extend the ESM consumer
rather than replacing the interop check; keep both claims separate.
