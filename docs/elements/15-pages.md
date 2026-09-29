# 15 — GitHub Pages documentation site

## Why

The library needs a browsable reference that ships with the repository but is
not part of the published package. A static site generated from checked-in
sources keeps the API, schema and export-format documentation reviewable in git,
while the build proves that every published page, link, asset and the version
marker came from that same revision.

## How to use

- Author pages as Markdown or MDX under `docs/page/src/content/docs/`; the
  Starlight sidebar and site metadata live in `docs/page/astro.config.mjs`.
- `make docs-build` builds the site inside the digest-pinned toolkit and then
  verifies it: the expected routes exist, the landing page displays the current
  package version, runtime assets stay local to the site, every internal link
  resolves to an emitted file, and `dist/.nojekyll` is present. It is part of
  `make verify`.
- `make docs-preview` serves the built site at
  `http://127.0.0.1:4321/canto-data/`; it is interactive and therefore not part
  of `verify`.
- `.github/workflows/pages.yml` runs `make docs-build` on `main` and deploys
  exactly `docs/page/dist` with the official Pages actions. No other step can
  publish the site.

The `docs/page/` project is independent of the published package: `pack-check`
forbids `docs/` inside the tarball, and the site never runs at package install
time.

## Authority

`docs/page/` owns the site sources and `toolkit/tools/lib/docs.js` owns the
build-and-verify contract. `.github/workflows/pages.yml` owns deployment and
holds no credentials beyond the Pages token it is granted. The package version
is read from `package.json` at build time; the site never carries a second
version authority. The site is the product reference: per 001/D27 `README.md` is
a short summary (badges, install, quick start, documentation index) that points
here for everything else.

## How to replace

Swap Astro/Starlight for another static generator by keeping the contract:
build from the repository at a pinned toolkit version, verify the emitted
routes, links, local-only assets and the version marker, and deploy only the
verified directory through the official Pages actions. A different hosting
provider replaces only the deploy job.
