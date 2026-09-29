# 06 — Browser consumer

## Why

The library must be usable from a browser bundler, not only from Node. This
element bundles the installed CommonJS package with a pinned esbuild and runs
the bundle in real headless Chromium from the pinned Playwright image, with
networking disabled. It proves **browser bundler consumption**, not native
unbundled ESM.

## How to use

```bash
make browser-consumer
```

- Preparation (toolkit image): install the packed tarball, write a bundler entry
  that imports the root and the `format`, `migration` and `validation` subpaths,
  and bundle with the pinned esbuild.
- Execution (Playwright image, `--network=none`): serve the bundle from an
  ephemeral localhost server, load it in headless Chromium and collect in-page
  results. Startup and navigation are bounded by Playwright timeouts and the
  browser/server are closed in a `finally` block.
- The bundle uses no Node globals, filesystem or network access; esbuild's
  browser platform rejects Node built-ins at bundle time.
- The gate also proves failure propagation: an unavailable browser, a failing
  in-page assertion and a broken package entry point must each make the gate
  fail non-zero.

## Authority

`toolkit/mk/browser.mk` owns image selection and orchestration; `toolkit/tools/lib/browser.js`
owns bundling, the static server and the Playwright run. Browser code is never
duplicated in the Node tests, and Node tests never substitute for this gate.

## How to replace

Update the browser image tag and digest in `toolkit/mk/toolkit.mk` together with
`playwright-core` in `package.json`; the versions must match exactly. If the
bundler changes, keep the bundle import surface (root plus representative
subpaths) and the failure-propagation checks.
