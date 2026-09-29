# Element: docs/elements/08-versioning.md
#
# CHANGELOG.md is the sole authored package version. These targets keep
# package.json, both root package-lock.json fields and the README badge in
# agreement, and validate the bump against the typed notes since a base ref.

VERSION_BASE ?= HEAD

.PHONY: version-check version-sync

version-check: deps ## Check version agreement and bump size against VERSION_BASE (default: HEAD)
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js version-check --root /work --base $(VERSION_BASE)

version-sync: deps ## Write the changelog version into package.json, the lockfile and the README badge
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js version-sync --root /work
