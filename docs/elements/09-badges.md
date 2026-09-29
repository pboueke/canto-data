# 09 — Badge evidence

## Why

README badges are claims. Parsing rounded console output made them partial
claims at best. This element derives the test-count and coverage badges from
machine-readable Jest reports only, and fails when the reports are missing,
malformed or failing.

## How to use

```bash
make test          # writes coverage/jest-results.json and coverage/coverage-summary.json
make badges-check  # read-only comparison against the README badges
make badges-sync   # rewrites the README badges (never stages)
```

- Inputs: `coverage/jest-results.json` (`--json --outputFile`) and
  `coverage/coverage-summary.json` (`json-summary` reporter).
- Missing files, invalid JSON, missing counts, failing tests or an empty run
  all fail closed. Checks are read-only; sync is explicit and non-staging.
- Coverage percentages are truncated, never rounded up, so a badge cannot
  overstate the measured value. Colors keep the existing thresholds:
  `brightgreen` ≥ 90, `yellow` ≥ 70, otherwise `red`.
- The version badge belongs to `version-sync` (element 08), not to this
  element.

## Authority

Jest owns the report contents; `toolkit/tools/lib/badges.js` owns badge grammar and
comparison. No script may scrape `stdout` for badge numbers.

## How to replace

Change the report readers while keeping the same two input files, the same
failure-closed behavior and the same badge grammar. Keep the color thresholds
in one place and test them at the boundaries.
