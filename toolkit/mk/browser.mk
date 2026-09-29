# Element: docs/elements/06-browser.md
#
# Bundle the installed package with pinned esbuild and execute it in real
# headless Chromium from the pinned Playwright image. The browser leg runs with
# networking disabled and proves failure propagation for an unavailable
# browser, a failing in-page assertion and a broken package entry point.

.PHONY: browser-consumer

browser-consumer: pack ## Bundle the tarball and run it in real headless Chromium
	@set -euo pipefail; \
	work="$$(mktemp -d /tmp/canto-data-browser.XXXXXX)"; \
	trap 'rm -rf "$$work"' EXIT; \
	prepare() { \
		$(PODMAN) run --rm --userns=keep-id --user $(UID_NUM):$(GID_NUM) \
			--tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/cache/npm \
			-v "$(ROOT)":/work:ro \
			-v "$(PACK_TARBALL)":/pack/package.tgz:ro \
			-v "$$work":/consumer \
			-v "$(NPM_CACHE)":/cache/npm \
			-w /consumer $(TOOLKIT_IMAGE) \
			node /work/toolkit/tools/cli/run.js browser-prepare \
				--tarball /pack/package.tgz --work /consumer --repo /work "$$@"; \
	}; \
	browser() { \
		$(PODMAN) run --rm --userns=keep-id --user $(UID_NUM):$(GID_NUM) \
			--tmpfs /tmp -e HOME=/tmp --network=none --shm-size=1g \
			-v "$(ROOT)":/work:ro \
			-v "$$work":/consumer \
			-w /consumer $(BROWSER_IMAGE) \
			node /work/toolkit/tools/cli/run.js browser-run --consumer /consumer "$$@"; \
	}; \
	prepare; \
	browser; \
	echo "browser-consumer: checking failure propagation"; \
	if browser --executable /nonexistent-chromium >/dev/null 2>&1; then \
		echo "browser-consumer: an unavailable browser did not fail the gate" >&2; exit 1; \
	fi; \
	prepare --work /consumer/failing --fail-check true; \
	if browser --consumer /consumer/failing >/dev/null 2>&1; then \
		echo "browser-consumer: a failing in-page assertion did not fail the gate" >&2; exit 1; \
	fi; \
	if prepare --work /consumer/broken --break-entry true >/dev/null 2>&1; then \
		echo "browser-consumer: a broken package entry point did not fail bundling" >&2; exit 1; \
	fi; \
	echo "browser-consumer: positive run and all failure-propagation scenarios behaved as expected"
