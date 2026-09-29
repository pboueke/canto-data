'use strict';

/* global window -- the evaluate callback below runs inside the browser page. */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { installPackage } = require('./installed');
const { parseArgs } = require('./args');

const LAUNCH_TIMEOUT_MS = 30_000;
const PAGE_TIMEOUT_MS = 30_000;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>canto-data browser consumer</title>
  </head>
  <body>
    <script src="app.js"></script>
  </body>
</html>
`;

/** Bundle entry: uses only the public package surface, with no Node globals. */
function entrySource(failCheck) {
  return `import * as canto from 'canto-data';
import { collectAttachmentEntries, parseManifest, serializePages, deserializePages } from 'canto-data/format';
import { migrateIfNeeded } from 'canto-data/migration';
import { isPage, validatePage } from 'canto-data/validation';

window.__runChecks = function () {
  const results = [];
  const check = function (name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (error) {
      results.push({ name: name, ok: false, message: String((error && error.message) || error) });
    }
  };

  const page = {
    id: 'i1',
    text: 'bundled page',
    date: '2026-01-01T00:00:00.000Z',
    tags: ['browser'],
    images: [{ id: 'img1', path: '/files/p.jpg', name: 'p.jpg', type: 'image', encrypted: false, deleted: false }],
    files: [],
    comments: [],
    modified: 1,
    deleted: false,
  };

  check('validates a synthetic page', function () {
    if (validatePage(page) !== page) throw new Error('validatePage did not return the input page');
    if (isPage(page) !== true) throw new Error('isPage rejected a valid page');
  });
  check('surfaces validation errors with field paths', function () {
    try {
      validatePage({});
    } catch (error) {
      if (error.name !== 'ValidationError' || error.field !== 'page.id') {
        throw new Error('validation error lost its field details');
      }
      return;
    }
    throw new Error('validatePage accepted an invalid page');
  });
  check('migrates legacy data', function () {
    const migrated = migrateIfNeeded({ settings: { showMarkdownPlaceholder: true } }, '0.16.0');
    if (migrated.migrated !== true) throw new Error('legacy data was not migrated');
    if ('showMarkdownPlaceholder' in migrated.data.settings) throw new Error('dead setting survived');
  });
  check('collects attachment entries', function () {
    const entries = collectAttachmentEntries([page]);
    if (entries[0].zipFilename !== 'image-img1.jpg') {
      throw new Error('unexpected zip filename: ' + entries[0].zipFilename);
    }
  });
  check('round-trips page serialization', function () {
    const restored = deserializePages(serializePages([page]));
    if (JSON.stringify(restored) !== JSON.stringify([page])) throw new Error('round trip changed data');
  });
  check('parses a legacy manifest', function () {
    const manifest = parseManifest(
      JSON.stringify({ version: 1, appVersion: '1', exportDate: 'd', encrypted: false, journalTitle: 't' }),
    );
    if (manifest.schemaVersion !== '0.16.0') throw new Error('unexpected schema version');
  });
  check('exposes the schema version', function () {
    if (typeof canto.SCHEMA_VERSION !== 'string' || canto.SCHEMA_VERSION === '') {
      throw new Error('SCHEMA_VERSION is missing');
    }
  });
  ${failCheck ? "check('deliberate browser failure', function () { throw new Error('deliberate assertion failure'); });\n  " : ''}
  return { ok: results.every(function (result) { return result.ok; }), results: results };
};
`;
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

/** Map a request URL onto a relative file inside the served directory. */
function resolveRequestPath(url) {
  if (typeof url !== 'string' || url === '') return 'index.html';
  const urlPath = url.split('?')[0];
  return urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
}

/** Minimal static server for the prepared bundle; closes deterministically. */
function startServer(dir) {
  const server = http.createServer((request, response) => {
    const relative = resolveRequestPath(request.url);
    const file = path.join(dir, relative);
    if (
      !file.startsWith(path.resolve(dir)) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(file) });
    response.end(fs.readFileSync(file));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function launchChromium(options) {
  return chromium.launch({
    headless: true,
    chromiumSandbox: false,
    timeout: LAUNCH_TIMEOUT_MS,
    executablePath: options.executablePath,
  });
}

/** Prepare runs in the toolkit image: install the tarball and bundle it. */
function createBrowserPrepare(io) {
  function bundle(args) {
    const esbuild = path.join(args.repo, 'node_modules', '.bin', 'esbuild');
    const result = io.run(esbuild, [
      '--bundle',
      path.join(args.work, 'entry.js'),
      `--outfile=${path.join(args.work, 'dist', 'app.js')}`,
      '--platform=browser',
      '--format=iife',
    ]);
    if (result.status !== 0) {
      throw new Error(`esbuild failed: ${(result.stderr || result.stdout).trim()}`);
    }
  }

  function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['tarball', 'work', 'repo']);
    } catch (error) {
      io.error(`browser-prepare: ${error.message}`);
      return 1;
    }
    const failCheck = args['fail-check'] === 'true';
    const breakEntry = args['break-entry'] === 'true';
    try {
      installPackage(io, args.work, args.tarball, 'canto-data-browser');
      if (breakEntry) {
        const moved = io.run(
          'mv',
          [
            path.join(args.work, 'node_modules', 'canto-data', 'dist', 'index.js'),
            path.join(args.work, 'index.js.bak'),
          ],
          { cwd: args.work },
        );
        if (moved.status !== 0) {
          throw new Error(
            `could not break the package entry point: ${moved.stderr || moved.stdout}`,
          );
        }
      }
      io.mkdirSync(path.join(args.work, 'dist'));
      io.writeFileSync(path.join(args.work, 'entry.js'), entrySource(failCheck));
      io.writeFileSync(path.join(args.work, 'dist', 'index.html'), INDEX_HTML);
      bundle(args);
      io.log(
        `browser-prepare: bundled the installed package (${failCheck ? 'failing' : 'passing'} checks)`,
      );
      return 0;
    } catch (error) {
      io.error(`browser-prepare: ${error.message}`);
      return 1;
    }
  }

  return { run, bundle, entrySource };
}

/** Run executes in the browser image with networking disabled. */
function createBrowserRun(io, deps = {}) {
  const launch = deps.launch ?? launchChromium;
  const serve = deps.startServer ?? startServer;

  async function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['consumer']);
    } catch (error) {
      io.error(`browser-run: ${error.message}`);
      return 1;
    }

    let server;
    try {
      server = await serve(path.join(args.consumer, 'dist'));
    } catch (error) {
      io.error(`browser-run: could not start the local server: ${error.message}`);
      return 1;
    }

    let browser = null;
    try {
      browser = await launch({ executablePath: args.executable });
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.port}/index.html`, {
        timeout: PAGE_TIMEOUT_MS,
        waitUntil: 'load',
      });
      const result = await page.evaluate(() => window.__runChecks());
      if (!result || result.ok !== true) {
        const failures = (result && result.results ? result.results : []).filter(
          (entry) => entry.ok !== true,
        );
        io.error(`browser-run: in-page checks failed (${failures.length})`);
        for (const failure of failures) io.error(`  - ${failure.name}: ${failure.message}`);
        return 1;
      }
      io.log(`browser-run: ${result.results.length} checks passed in headless Chromium`);
      return 0;
    } catch (error) {
      io.error(`browser-run: ${error.message}`);
      return 1;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
      await server.close();
    }
  }

  return { run };
}

module.exports = {
  createBrowserPrepare,
  createBrowserRun,
  entrySource,
  startServer,
  launchChromium,
  contentType,
  resolveRequestPath,
  INDEX_HTML,
};
