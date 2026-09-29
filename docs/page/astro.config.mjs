// Astro + Starlight configuration for the canto-data documentation site.
//
// This project is a presentation layer for the canto-data library: a static
// site published to GitHub Pages at https://pboueke.github.io/canto-data/.
// The `base` value must match the repository name exactly, because GitHub
// Pages serves project sites from https://<owner>.github.io/<repository>/.
//
// `make docs-build` runs this build inside the digest-pinned toolkit and then
// verifies every emitted page, link, asset and the version marker.
import { createRequire } from 'node:module';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/** The GitHub Pages origin and the repository sub-path the site is served from. */
export const site = 'https://pboueke.github.io';
/** The repository sub-path, derived from the repository name. */
export const base = '/canto-data/';
/** The canonical repository URL linked from every page. */
export const repositoryUrl = 'https://github.com/pboueke/canto-data';

/** The package version, read from the repository manifest at build time. */
const { version } = createRequire(import.meta.url)('../../package.json');

export default defineConfig({
  site,
  base,
  // A single static build; no server output, adapter or runtime network access.
  output: 'static',
  trailingSlash: 'always',
  vite: {
    // The landing page renders the authored package version; docs-build fails
    // when the built HTML does not carry it.
    define: { __CANTO_DATA_VERSION__: JSON.stringify(version) },
  },
  integrations: [
    starlight({
      title: 'canto-data',
      description:
        'TypeScript types, runtime validation, schema migration and export format utilities for Canto journals.',
      favicon: '/favicon.png',
      social: [{ icon: 'github', label: 'GitHub', href: repositoryUrl }],
      editLink: { baseUrl: `${repositoryUrl}/edit/main/` },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Getting started', link: '/getting-started/' },
        {
          label: 'Guides',
          items: [
            { label: 'Usage', link: '/usage/' },
            { label: 'Export format', link: '/export-format/' },
            { label: 'Schema versions', link: '/schema/' },
            { label: 'Canto app storage', link: '/storage/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Data model', link: '/data-model/' },
            { label: 'API', link: '/api/' },
            { label: 'Relationship to the app', link: '/relationship/' },
            { label: 'Development and verification', link: '/development/' },
          ],
        },
      ],
    }),
  ],
});
