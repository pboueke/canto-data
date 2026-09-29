# 07 — Dependency audit

## Why

A library with zero runtime dependencies still has a large development graph
(Jest, ts-jest, ESLint, TypeScript tooling). Vulnerable build tooling can
compromise releases, so the gate audits the whole locked graph and refuses to
pass on unexamined HIGH/CRITICAL findings.

## How to use

```bash
make audit
```

- Runs `npm audit --json` inside the pinned toolkit over the locked graph,
  including development dependencies.
- Every HIGH/CRITICAL finding must be covered by an entry in
  `toolkit/tools/audit/exceptions.json` with an `advisoryId`, a `reason` and an
  `expires` date. Expired exceptions do not cover anything.
- The gate fails closed: a registry failure, malformed JSON report, missing
  vulnerabilities object, malformed exception file or expired exception all
  fail non-zero. An offline machine cannot silently pass.
- This is a dependency gate only. It does not claim to scan OS images.

## Authority

`toolkit/tools/lib/audit.js` owns parsing, exception validation and violation logic;
`toolkit/tools/audit/exceptions.json` owns the reviewed waivers. Do not silence a
finding by lowering the severity threshold; add an exception with an expiry and
a plan, or upgrade the dependency.

## How to replace

Move the audit into another scanner by replacing `createAudit` while preserving
the same inputs (locked graph), the same output (exit code plus actionable
lines) and the same exception schema. Keep re-auditing on every verify run.
