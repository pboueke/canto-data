# 13 — Portable agent guidance

## Why

Agent instructions previously lived in tool-specific configuration. That made
repository policy depend on one vendor, one machine and one harness. `AGENTS.md`
states the same rules in a portable form that any human or agent can read and
that survives tool changes.

## How to use

Read `AGENTS.md` before changing the repository. It covers, in this order:
command authority (`make verify`), host requirements, the absolute 100% coverage
floor, the spec-first approval workflow, the no-history-write rule (agents do
not commit, push, tag, revert or publish), confirmation before destructive
operations, and the element-documentation rule.

The file intentionally names no agent product, no workstation path and no
sibling checkout, so it stays valid for any contributor.

## Authority

`AGENTS.md` is guidance, not runtime enforcement. Enforcement lives in the gates
(`make verify`), the hooks and CI. When the two disagree, the gates are the
truth and `AGENTS.md` must be corrected.

## How to replace

Keep the document portable and short; replace prose with a pointer to the gate
or element document that actually enforces a rule. If a harness needs its own
configuration, add it as an _adapter_ that points here rather than a second
policy source.
