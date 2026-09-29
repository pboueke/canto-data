# Element: docs/elements/04-consumers.md
# Element: docs/elements/05-integration.md
#
# Prove the installed artifact: pack the built library, inspect the tarball,
# and install it in disposable consumers outside the repository on every
# supported Node runtime.

PACKAGE_VERSION := $(shell sed -nE 's/^[[:space:]]*"version": "([^"]+)".*/\1/p' package.json | head -n1)
PACK_TARBALL := $(PACK_DIR)/canto-data-$(PACKAGE_VERSION).tgz
PACK_TARBALL_CONTAINER := /work/.cache/canto-data/pack/canto-data-$(PACKAGE_VERSION).tgz

.PHONY: pack pack-check consumer-test integration

pack: build ## Pack the built library into $(PACK_DIR)
	@rm -rf "$(PACK_DIR)"
	@mkdir -p "$(PACK_DIR)"
	$(TOOLKIT_RUN) npm pack --ignore-scripts --pack-destination /work/.cache/canto-data/pack
	@test -f "$(PACK_TARBALL)" || { echo "pack: expected $(PACK_TARBALL)"; exit 1; }

pack-check: pack ## Inspect tarball contents, identity and runtime dependencies
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js pack-check $(PACK_TARBALL_CONTAINER)

consumer-test: pack pack-check ## Install the tarball in Node 18/20/22/24 consumers and check CJS, ESM and declarations
	@set -euo pipefail; \
	work="$$(mktemp -d /tmp/canto-data-consumer.XXXXXX)"; \
	trap 'rm -rf "$$work"' EXIT; \
	for entry in "18 $(NODE18_IMAGE)" "20 $(NODE20_IMAGE)" "22 $(NODE22_IMAGE)" "24 $(NODE24_IMAGE)"; do \
		version="$${entry%% *}"; image="$${entry#* }"; \
		dir="$$work/node-$$version"; mkdir -p "$$dir"; \
		echo "consumer-test: node $$version"; \
		$(PODMAN) run --rm --userns=keep-id --user $(UID_NUM):$(GID_NUM) \
			--tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/cache/npm \
			-v "$(ROOT)":/work:ro \
			-v "$(PACK_TARBALL)":/pack/package.tgz:ro \
			-v "$$dir":/consumer \
			-v "$(NPM_CACHE)":/cache/npm \
			-w /consumer "$$image" \
			node /work/toolkit/tools/cli/run.js consumer-run \
				--tarball /pack/package.tgz --work /consumer --node-version "$$version"; \
	done

integration: pack ## Drive the installed-package data lifecycle with a controlled clock
	@set -euo pipefail; \
	work="$$(mktemp -d /tmp/canto-data-integration.XXXXXX)"; \
	trap 'rm -rf "$$work"' EXIT; \
	$(PODMAN) run --rm --userns=keep-id --user $(UID_NUM):$(GID_NUM) \
		--tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/cache/npm \
		-v "$(ROOT)":/work:ro \
		-v "$(PACK_TARBALL)":/pack/package.tgz:ro \
		-v "$$work":/consumer \
		-v "$(NPM_CACHE)":/cache/npm \
		-w /consumer $(TOOLKIT_IMAGE) \
		node /work/toolkit/tools/cli/run.js integration --tarball /pack/package.tgz --work /consumer
