# Element: docs/elements/03-contracts.md
#
# Committed synthetic fixtures are the reviewed contract for the public
# validators, migration runner and format helpers. They run against the built
# dist output so the check exercises what consumers install.

.PHONY: contract-check

contract-check: build ## Check committed fixtures against the built public API
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js contract-check
