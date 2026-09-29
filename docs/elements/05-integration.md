# 05 — Installed-package integration lifecycle

## Why

Unit tests call source modules; contract fixtures check individual helpers. The
integration element proves that the **installed tarball** drives a complete data
lifecycle the way a consumer would: legacy migration, validation, attachment
mapping, serialization and manifest construction/parsing.

## How to use

```bash
make integration
```

- The tarball is installed in a disposable consumer outside the repository and
  loaded from `node_modules/canto-data` — never from the checkout.
- The fixture starts from legacy `0.16.0` data with a dead setting, then
  asserts each stage preserves the data it must preserve:
  - migration removes `showMarkdownPlaceholder` while keeping other fields;
  - validation accepts the migrated content;
  - attachment collection keeps disk paths and derives portable ZIP names;
  - path rewriting clones pages without mutating the originals;
  - serialization round-trips unchanged;
  - manifest construction uses a **controlled clock** and a caller-supplied
    `appVersion`, keeping package, schema and manifest versions independent.
- Validation and migration failures are part of the fixture, so the error
  surface is exercised too.

## Authority

`toolkit/tools/lib/installed.js` owns the lifecycle fixture. It asserts, it does not
reimplement: every operation is called on the installed public API.

## How to replace

Extend the lifecycle when new public capabilities appear, keeping assertions
data-preservation based rather than byte-identical for time-dependent output.
If a faster check is needed during development, keep this gate intact and
subset it with `make pack integration` explicitly.
