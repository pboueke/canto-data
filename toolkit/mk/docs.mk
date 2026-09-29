# Element: docs/elements/15-pages.md
#
# Build and verify the Starlight documentation site that GitHub Pages serves.
# The build never touches the network and the deploy job only uploads the
# verified dist directory through the official Pages actions.

.PHONY: docs-build docs-preview

docs-build: deps ## Build and verify the GitHub Pages documentation site
	$(TOOLKIT_RUN) node toolkit/tools/cli/run.js docs-build --root /work

docs-preview: docs-build ## Serve the built site at http://127.0.0.1:4321/canto-data/ (Ctrl-C to stop)
	@printf '%s\n' 'docs-preview: serving http://127.0.0.1:4321/canto-data/ (press Ctrl-C to stop)'
	$(PODMAN) run --rm -it --userns=keep-id --user $(UID_NUM):$(GID_NUM) \
		--tmpfs /tmp -e HOME=/tmp \
		-v "$(ROOT)":/work -w /work -p 127.0.0.1:4321:4321 \
		$(TOOLKIT_IMAGE) node node_modules/astro/bin/astro.mjs preview \
		--root docs/page --host 0.0.0.0 --port 4321
