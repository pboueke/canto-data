# Element: docs/elements/09-badges.md
#
# Test and coverage badges derive from machine-readable Jest reports, never
# from console output. Checks are read-only; sync writes the README only.

.PHONY: badges-check badges-sync

badges-check: deps ## Check README badges against coverage/jest-results.json and coverage-summary.json
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js badges-check --root /work

badges-sync: deps ## Rewrite README badges from successful machine-readable test reports
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js badges-sync --root /work
