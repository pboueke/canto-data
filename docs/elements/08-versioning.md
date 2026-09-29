# 08 — Version authority

## Why

Three carriers used to disagree silently: `CHANGELOG.md`, `package.json` and
the two root `package-lock.json` version fields (the README badge was a fourth).
The changelog is the authored release history, so it must be the single version
authority, and every check must either agree or fail with the exact repair
command.

## How to use

```bash
make version-check                      # read-only; compares against VERSION_BASE (default HEAD)
make version-check VERSION_BASE=origin/main
make version-sync                       # writes the changelog version into the other carriers
```

- Release headings keep the existing grammar: `## vX.Y.Z - description`.
- New entries use typed notes: `- breaking: ...` (major), `- feat: ...`
  (minor), and `- fix:`, `- chore:`, `- docs:`, `- ci:`, `- test:` (patch).
- `version-check` verifies:
  1. changelog, `package.json`, both lockfile fields and the README version
     badge all agree;
  2. a comparison base is explicitly resolved and readable — a missing base
     fails closed instead of silently disabling the history check;
  3. the version advances monotonically from the base;
  4. the applied bump matches the typed notes added since the base, without
     reinterpreting older history.
- `version-sync` writes the changelog version into `package.json`, both
  lockfile fields and the README badge, and never stages anything.
- Spec-only approval is exempt from requiring a release bump, not from these
  checks: an unchanged version passes the delta check, while any drift still
  fails.

## Authority

`CHANGELOG.md` owns the package release version. Schema `0.19.0`, manifest
format `1` and caller-supplied `appVersion` are separate authorities and must
not move with package releases.

## How to replace

Replace `createVersionCheck`/`createVersionSync` while keeping the four
carriers, the explicit base, the typed-note bump rule and the read-only/write
split. CI passes `VERSION_BASE` from the event payload; hooks use `HEAD`.
