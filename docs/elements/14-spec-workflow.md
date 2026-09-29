# 14 — Spec workflow

## Why

Changes of this size need recorded intent, explicit approval and stable
decisions that later work can cite. The workflow keeps that record in the
repository instead of an external tracker that can drift or disappear.

## How to use

- Draft specs in `docs/spec/active/NNN-slug/spec.md`; see
  [docs/spec/README.md](../spec/README.md) for layout and lifecycle.
- Approve by a spec-only merge or an explicit owner-authored spec-only commit;
  only then start implementation.
- Cite decisions as `NNN/D<n>`. Decisions are append-only; superseding a
  decision means adding a new one that references the old.
- Keep completion evidence next to the spec (`evidence.md`) and archive the
  directory only when the definition of done holds against real evidence.
- Record necessary implementation deviations as new decisions rather than
  changing accepted ones.

## Authority

The spec owns intent, scope, requirements and the definition of done for its
change. The gates own whether the change is verified. A spec cannot lower a
gate or authorize publishing, tagging, history rewrites or work in another
repository.

## How to replace

The workflow is plain Markdown in a conventional directory; replacing it means
moving the same active/archive layout to another directory and updating
`AGENTS.md` and this document together. Do not split approval records between
two systems.
