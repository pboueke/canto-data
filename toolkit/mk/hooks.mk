# Element: docs/elements/10-hooks.md
#
# One opt-in hook authority: .githooks, installed explicitly and never by
# npm ci. Hooks are read-only over the index and never stage files.

.PHONY: hooks-install hook-pre-commit

hooks-install: deps ## Install the repository-local .githooks path (idempotent, refuses other paths)
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js hooks-install --root /work

hook-pre-commit: deps ## Fast staged-change checks used by .githooks/pre-commit
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js hook-pre-commit --root /work --node-modules /work/node_modules
