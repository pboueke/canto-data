# Element: docs/elements/01-toolkit.md
#
# Pinned rootless-Podman toolkit and the single container runner every gate
# uses. Nothing here needs node or npm on the host.

PODMAN ?= podman
TOOLKIT_IMAGE ?= canto-data-toolkit:1

# Pinned base images (multi-arch digests resolved during implementation).
NODE24_IMAGE ?= docker.io/library/node@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4
NODE18_IMAGE ?= docker.io/library/node@sha256:c6ae79e38498325db67193d391e6ec1d224d96c693a8a4d943498556716d3783
NODE20_IMAGE ?= docker.io/library/node@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5
NODE22_IMAGE ?= docker.io/library/node@sha256:363e1587494626837fa7f9a23bdb453d13b0ff3c67c705c2805cfc69c2d2fad7
BROWSER_IMAGE ?= mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
SHELLCHECK_IMAGE ?= docker.io/koalaman/shellcheck@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d

CACHE_ROOT := $(ROOT)/.cache/canto-data
NPM_CACHE := $(CACHE_ROOT)/npm
PACK_DIR := $(CACHE_ROOT)/pack
REPORT_DIR := $(CACHE_ROOT)/reports

UID_NUM := $(shell id -u)
GID_NUM := $(shell id -g)

# Run a command in the pinned toolkit with the checkout mounted and
# host-user-compatible file ownership. Host caches keep container startup cheap.
TOOLKIT_RUN = $(PODMAN) run --rm \
	--userns=keep-id --user $(UID_NUM):$(GID_NUM) \
	--tmpfs /tmp -e HOME=/tmp \
	-e npm_config_cache=/cache/npm \
	-v "$(ROOT)":/work \
	-v "$(NPM_CACHE)":/cache/npm \
	-w /work \
	$(TOOLKIT_IMAGE)

.PHONY: preflight toolkit-build deps

preflight: ## Fail unless the host has a usable rootless Podman runtime
	@command -v $(PODMAN) >/dev/null 2>&1 || { \
		echo "preflight: 'podman' is required; install a rootless runtime and retry." >&2; \
		exit 1; \
	}
	@test "$$($(PODMAN) info --format '{{.Host.Security.Rootless}}' 2>/dev/null)" = "true" || { \
		echo "preflight: rootless Podman is required; refusing a root or unavailable runtime." >&2; \
		exit 1; \
	}
	@mkdir -p "$(NPM_CACHE)" "$(PACK_DIR)" "$(REPORT_DIR)"
	@echo "preflight: rootless podman $$($(PODMAN) --version | awk '{print $$3}') ok"

toolkit-build: preflight ## Build the digest-pinned Node 24 toolkit image
	@$(PODMAN) build --pull=missing \
		--build-arg NODE_IMAGE=$(NODE24_IMAGE) \
		-t $(TOOLKIT_IMAGE) \
		-f toolkit/Containerfile \
		toolkit >/dev/null
	@actual="$$($(PODMAN) image inspect $(TOOLKIT_IMAGE) --format '{{index .Config.Labels "org.canto-data.node-image"}}')"; \
	test "$$actual" = "$(NODE24_IMAGE)" || { \
		echo "toolkit-build: image label '$$actual' does not match pin '$(NODE24_IMAGE)'" >&2; \
		exit 1; \
	}
	@echo "toolkit-build: $(TOOLKIT_IMAGE) ready with $$($(PODMAN) run --rm $(TOOLKIT_IMAGE) node --version)"

node_modules/.package-lock.json: package.json package-lock.json | toolkit-build
	@mkdir -p "$(NPM_CACHE)"
	$(TOOLKIT_RUN) npm ci --ignore-scripts --no-audit --no-fund

deps: node_modules/.package-lock.json ## Install locked dependencies with frozen npm ci

.PHONY: purge-cache
purge-cache: ## Remove only canto-data container caches and ignored build output
	@rm -rf "$(CACHE_ROOT)" "$(ROOT)/dist"
	@echo "purge-cache: removed .cache/canto-data and dist"
