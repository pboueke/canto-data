# Element: docs/elements/02-gates.md
#
# The check gates run in the pinned toolkit. npm scripts stay the leaf
# commands; Make adds the container, ordering and failure semantics.

.PHONY: fmt fmt-check lint types test build shellcheck

fmt: deps ## Rewrite formatting for maintained TS/JS, JSON, Markdown and YAML
	$(TOOLKIT_RUN) npm run format

fmt-check: deps ## Verify formatting without writing
	$(TOOLKIT_RUN) npm run format:check

lint: deps ## Run ESLint over maintained source and executable helpers
	$(TOOLKIT_RUN) npm run lint

types: deps ## Run strict TypeScript checks including tests
	$(TOOLKIT_RUN) npm run typecheck

test: deps ## Run the Jest suite with 100% coverage thresholds and machine-readable reports
	$(TOOLKIT_RUN) npm run test:ci

build: deps ## Compile the CommonJS distribution and declarations
	$(TOOLKIT_RUN) npm run build

shellcheck: ## Lint all tracked and in-progress shell scripts with ShellCheck
	@set -euo pipefail; \
	cd "$(ROOT)"; \
	scripts="$$( { find .githooks toolkit .github -type f 2>/dev/null | grep -E '(\.sh$$|^\.githooks/)'; find . -maxdepth 1 -type f -name '*.sh'; } | sort || true)"; \
	if [ -z "$$scripts" ]; then \
		echo "shellcheck: no shell scripts found — refusing an empty inventory" >&2; \
		exit 1; \
	fi; \
	$(PODMAN) run --rm -v "$(ROOT)":/mnt:ro -w /mnt $(SHELLCHECK_IMAGE) -x $$scripts
