# 10 — Git hooks

## Why

Husky ran uncontrolled scripts, auto-staged files (including rewriting the
index) and could not be reasoned about from the repository alone. The project
needs exactly one hook authority that is explicit, repository-local and
read-only over the index — plus fast, actionable failure messages.

## How to use

```bash
make hooks-install   # sets core.hooksPath=.githooks locally (idempotent)
```

- `.githooks/pre-commit` calls `make hook-pre-commit`; `.githooks/pre-push`
  calls the full `make verify`.
- The installer refuses to overwrite a different configured hook path without
  owner action (`--force true`), and `npm ci` never installs hooks because the
  package has no `prepare` script.
- Pre-commit checks the **staged** change set:
  - nothing staged passes immediately;
  - partially staged metadata (`package.json`, `package-lock.json`,
    `README.md`, `CHANGELOG.md`) is rejected so checks cannot describe an
    ambiguous state;
  - formattable staged files are checked with Prettier against their staged
    content (`git show :file` piped on stdin), not the worktree;
  - staged metadata triggers read-only `version-check` and `badges-check`;
    missing test reports produce the actionable `make test` /
    `make badges-sync` message.
- Hooks never stage, never replace the index and never rewrite tracked files.

## Authority

`.githooks` is the only hook authority; Husky and lint-staged were removed at
this cutover. `toolkit/tools/lib/hooks.js` owns the behavior and is unit- and
behaviorally tested against real git repositories, including failure paths.

## How to replace

Change hook content by editing `.githooks/*` and their tests together. Keep
the installer’s conflict refusal and the read-only guarantee. Hooks are
convenience controls: CI from a fresh checkout is the bypass-resistant
backstop, so never move required checks exclusively into hooks.
