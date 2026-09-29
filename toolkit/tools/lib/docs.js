'use strict';

const path = require('node:path');
const { parseArgs } = require('./args');

/** Routes the Starlight build must emit, relative to the site base path. */
const ROUTES = [
  '',
  'getting-started',
  'usage',
  'export-format',
  'schema',
  'data-model',
  'storage',
  'relationship',
  'development',
  'api',
];
/** The GitHub Pages project path the site is served from. */
const BASE = '/canto-data/';
/** Astro project directory, relative to the repository root. */
const SITE_DIR = 'docs/page';
/** Built static site, relative to the repository root. */
const DIST_DIR = 'docs/page/dist';

/** Schemes and fragment-only links that never map to a file in the build. */
const SKIP_LINK = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const ASSET_TAG = /<(script|img|iframe|source|video|audio)\b([^>]*)>/gi;
const LINK_TAG = /<link\b([^>]*)>/gi;
const ATTRIBUTE = /\b(?:src|href)\s*=\s*"([^"]*)"/i;
const HREF = /\bhref\s*=\s*"([^"]*)"/gi;
const ASSET_REL = /\brel\s*=\s*"(?:stylesheet|preload|icon|shortcut icon)"/i;
const REMOTE = /^(?:https?:)?\/\//i;

/** Every href in a built page, in document order. */
function extractHrefs(html) {
  const hrefs = [];
  const pattern = new RegExp(HREF.source, HREF.flags);
  let match;
  while ((match = pattern.exec(html)) !== null) hrefs.push(match[1]);
  return hrefs;
}

/** True when a URL points at a network origin rather than this site. */
function isRemote(url) {
  return REMOTE.test(url);
}

/** Remote runtime asset references found in one built page. */
function remoteAssetReferences(html) {
  const found = [];
  let match;
  const assets = new RegExp(ASSET_TAG.source, ASSET_TAG.flags);
  while ((match = assets.exec(html)) !== null) {
    const attribute = ATTRIBUTE.exec(match[2]);
    if (attribute && isRemote(attribute[1])) found.push(attribute[1]);
  }
  const links = new RegExp(LINK_TAG.source, LINK_TAG.flags);
  while ((match = links.exec(html)) !== null) {
    if (!ASSET_REL.test(match[1])) continue;
    const attribute = ATTRIBUTE.exec(match[1]);
    if (attribute && isRemote(attribute[1])) found.push(attribute[1]);
  }
  return found;
}

/**
 * Resolve one href from a built page to a file inside the dist directory.
 * Returns null for links that need no check (external, mailto, fragment-only)
 * and throws when an absolute link escapes the site base path.
 */
function resolveHref(href, pageRoute) {
  const trimmed = String(href).trim();
  if (trimmed === '' || SKIP_LINK.test(trimmed)) return null;
  const withoutQuery = trimmed.split(/[?#]/)[0];
  if (withoutQuery === '') return null;
  let target;
  if (withoutQuery.startsWith(BASE)) {
    target = withoutQuery.slice(BASE.length);
  } else if (withoutQuery.startsWith('/')) {
    throw new Error(`internal link '${trimmed}' is outside the site base ${BASE}`);
  } else {
    target = path.posix.join(pageRoute, withoutQuery);
  }
  const normalized = path.posix.normalize(target).replace(/^\.\//, '');
  if (normalized === '' || normalized === '.') return 'index.html';
  if (normalized.endsWith('/')) return `${normalized}index.html`;
  if (!path.posix.basename(normalized).includes('.')) return `${normalized}/index.html`;
  return normalized;
}

/** The authored package version, used as the landing-page marker. */
function readVersion(io, root) {
  const file = path.join(root, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(io.readFileSync(file));
  } catch (error) {
    throw new Error(`cannot read ${file}: ${error.message}`, { cause: error });
  }
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    throw new Error(`${file} has no version`);
  }
  return pkg.version;
}

/**
 * Verify the built site: required pages, the version marker, local-only runtime
 * assets and every internal link resolving to a emitted file.
 */
function checkBuiltSite(io, root, version) {
  const dist = path.join(root, DIST_DIR);
  const problems = [];
  if (!io.existsSync(path.join(dist, '.nojekyll'))) {
    problems.push(`${DIST_DIR}/.nojekyll is missing`);
  }
  const pages = [];
  for (const route of ROUTES) {
    const file = route === '' ? 'index.html' : `${route}/index.html`;
    if (!io.existsSync(path.join(dist, file))) {
      problems.push(`missing page ${file}`);
      continue;
    }
    pages.push({
      route: route === '' ? '' : `${route}/`,
      file,
      html: io.readFileSync(path.join(dist, file)),
    });
  }
  const landing = pages.find((page) => page.file === 'index.html');
  if (landing && !landing.html.includes(`v${version}`)) {
    problems.push(`landing page does not display version v${version}`);
  }
  for (const page of pages) {
    for (const url of remoteAssetReferences(page.html)) {
      problems.push(`remote asset '${url}' in ${page.file}`);
    }
    for (const href of extractHrefs(page.html)) {
      let target;
      try {
        target = resolveHref(href, page.route);
      } catch (error) {
        problems.push(`${page.file}: ${error.message}`);
        continue;
      }
      if (target === null) continue;
      if (!io.existsSync(path.join(dist, target))) {
        problems.push(`${page.file}: broken link '${href}' -> ${target}`);
      }
    }
  }
  return problems;
}

/** The docs-build gate: build the Starlight site and verify the emitted pages. */
function createDocs(io) {
  function run(argv) {
    try {
      const args = parseArgs(argv, ['root']);
      const root = args.root;
      const version = readVersion(io, root);
      const astro = path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
      if (!io.existsSync(astro)) {
        throw new Error('astro is not installed; run make deps');
      }
      const build = io.run(process.execPath, [astro, 'build', '--root', SITE_DIR]);
      if (build.status !== 0) {
        throw new Error(`astro build failed: ${(build.stderr || build.stdout).trim()}`);
      }
      const problems = checkBuiltSite(io, root, version);
      if (problems.length > 0) {
        io.error(`docs-build: ${problems.length} problem(s)`);
        for (const problem of problems) io.error(`  - ${problem}`);
        return 1;
      }
      io.log(`docs-build: ${ROUTES.length} page(s) verified under ${BASE} (version ${version})`);
      return 0;
    } catch (error) {
      io.error(`docs-build: ${error.message}`);
      return 1;
    }
  }

  return { run, checkBuiltSite, resolveHref, extractHrefs, remoteAssetReferences, readVersion };
}

module.exports = {
  createDocs,
  extractHrefs,
  remoteAssetReferences,
  resolveHref,
  readVersion,
  checkBuiltSite,
  BASE,
  ROUTES,
  SITE_DIR,
  DIST_DIR,
};
