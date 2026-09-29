/// <reference types="astro/client" />

import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// The Starlight documentation collection. Starlight loads pages from
// `src/content/docs/`; every page is authored here and the built output is
// verified by `make docs-build` (which also generates the Astro virtual-module
// types under `.astro/` before any type check runs).
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
