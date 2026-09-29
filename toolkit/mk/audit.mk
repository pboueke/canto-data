# Element: docs/elements/07-audit.md
#
# Audit the whole locked dependency graph (development tools included) and fail
# on HIGH/CRITICAL findings without a reviewed, unexpired exception. Registry
# failures and malformed reports fail closed.

.PHONY: audit

audit: deps ## Fail closed on HIGH/CRITICAL vulnerabilities without a valid exception
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js audit
