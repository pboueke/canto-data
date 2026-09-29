# Specification workflow

Specs record intent and decisions before implementation. They live in this
repository only; no external tracker is required.

## Layout

```text
docs/spec/
├── active/NNN-slug/spec.md      # proposed, approved or in implementation
├── archive/NNN-slug/spec.md     # approved and completed, with evidence
└── README.md
```

- `NNN` is a local, monotonically increasing, three-digit number allocated
  across active and archive specs. Never reuse a number.
- `slug` is a short kebab-case name. Keep the directory name stable so inbound
  links survive archiving.

## Lifecycle

1. **Draft.** Add `active/NNN-slug/spec.md` in a spec-only change. A draft
   authorizes nothing.
2. **Approval.** A spec is approved by its spec-only merge or by an explicit
   owner-authored spec-only approval commit. Implementation starts only after
   approval.
3. **Implementation.** Implement in the ordered stages the spec defines. Each
   stage should leave exactly one authority per concern; do not cut over two
   competing mechanisms at once.
4. **Evidence.** Completion evidence belongs next to the spec (for example an
   `evidence.md` in the same directory) or in the implementation change itself.
   Claims copied from another repository are not evidence.
5. **Archive.** Move the directory to `archive/` only when the spec's definition
   of done holds against real evidence.

## Decisions

- Decisions are numbered `D1`, `D2`, ... inside a spec and cited as `NNN/D<n>`
  (for example `001/D6`).
- Decisions are append-only. Do not rewrite, renumber or delete an accepted
  decision.
- To change a decision, add a new decision that cites the one it supersedes.
- Necessary deviations discovered during implementation are recorded as new
  decisions in the implementation change, never applied silently.

## Boundaries

- Specs do not grant permission to publish, tag, rewrite history or modify
  other repositories.
- Verification gates named by a spec must be real commands with real failure
  modes; a spec is not allowed to weaken a gate so that it can pass.
- Keep specs in Prettier-formatted Markdown so the formatting gate covers them.
