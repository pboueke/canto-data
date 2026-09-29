# canto-data verification and delivery map.
#
# Each `include` fragment below corresponds to one element documented under
# docs/elements/. `make help` is the discoverable index of targets and element
# fragments; `make verify` is the authoritative gate.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

include toolkit/mk/toolkit.mk
include toolkit/mk/gates.mk
include toolkit/mk/contracts.mk
include toolkit/mk/consumers.mk
include toolkit/mk/browser.mk
include toolkit/mk/audit.mk
include toolkit/mk/version.mk
include toolkit/mk/badges.mk
include toolkit/mk/hooks.mk
include toolkit/mk/docs.mk

.PHONY: help verify

help: ## Show the target map and the element documentation index
	@echo "canto-data — target map"
	@echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' Makefile toolkit/mk/*.mk | sed -E 's/:.*## / — /' | sort | sed 's/^/  /'
	@echo
	@echo "Elements (docs/elements/):"
	@grep -hE '^# Element: ' toolkit/mk/*.mk | sed -E 's/^# Element: /  /' | sort
	@echo
	@echo "Authoritative gate: make verify"

verify: preflight toolkit-build deps fmt-check lint types test build contract-check integration consumer-test browser-consumer audit version-check badges-check docs-build shellcheck ## Run every required gate
