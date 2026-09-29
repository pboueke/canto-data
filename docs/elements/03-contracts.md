# 03 — Contract fixtures

## Why

The library's public behaviour is the product: validators, the migration runner
and the export-format helpers. An auto-generated contract would become a second
schema authority. Instead, committed synthetic fixtures record reviewed input →
output expectations, including the deliberately permissive outcomes, and fail
when behaviour drifts.

## How to use

```bash
make contract-check
```

- Fixtures live in `toolkit/fixtures/contract/` as JSON files, each containing one case
  or an array of named cases.
- A case names an `operation`, an `input` and an `expect`:
  - `expect.ok: true` requires `expect.value` (use `"$input"` for identity).
  - `expect.ok: false` requires `expect.error` with `name` and optionally
    `message`, `messageContains`, `field`, `expected`, `received`.
- The check runs against `dist/index.js`, the same artifact consumers install,
  so it covers the built public surface rather than source modules.
- Cases that pass but are not asserted by any fixture, missing fixture files and
  malformed cases all fail closed.

Coverage includes valid current data, legacy `0.16.0` migration, future-version
rejection, missing migration paths, `ValidationError` fields, shallow type
guards versus structural validators, manifest parsing, attachment collection
and path rewriting, and page serialization.

## Authority

`toolkit/fixtures/contract/` owns the reviewed compatibility outcomes. The existing
types, validators and migration registry remain the implementation authority;
changing an outcome requires an explicit decision and a fixture update, never an
incidental tooling refactor.

## How to replace

Keep the fixture format; replacing the runner means preserving the same files
and the same failure semantics. Add a new operation in
`toolkit/tools/lib/contracts.js` only with unit tests, then add fixtures that use it.
