'use strict';

const path = require('node:path');
const {
  createDocs,
  extractHrefs,
  remoteAssetReferences,
  resolveHref,
  readVersion,
  checkBuiltSite,
  ROUTES,
} = require('../lib/docs');

const ROOT = '/work';
const DIST = path.join(ROOT, 'docs/page/dist');

function pageFiles(version) {
  const files = {
    [path.join(ROOT, 'package.json')]: JSON.stringify({ version }),
    [path.join(ROOT, 'node_modules/astro/bin/astro.mjs')]: '',
    [path.join(DIST, '.nojekyll')]: '',
    [path.join(DIST, 'index.html')]: `<a href="${'/canto-data/usage/'}">v${version}</a>`,
  };
  for (const route of ROUTES) {
    if (route === '') continue;
    files[path.join(DIST, route, 'index.html')] = `<a href="${'/canto-data/'}">${route}</a>`;
  }
  return files;
}

function fakeIo({
  files = {},
  missing = [],
  runResult = { status: 0, stdout: '', stderr: '' },
  runThrows = null,
} = {}) {
  return {
    existsSync: jest.fn((file) => !missing.includes(file) && file in files),
    readFileSync: jest.fn((file) => files[file]),
    run: jest.fn(() => {
      if (runThrows) throw runThrows;
      return runResult;
    }),
    log: jest.fn(),
    error: jest.fn(),
  };
}

describe('extractHrefs', () => {
  test('returns every href in document order', () => {
    expect(extractHrefs('<a href="/a/">x</a><link href="/b.css">')).toEqual(['/a/', '/b.css']);
  });

  test('returns nothing without hrefs', () => {
    expect(extractHrefs('<p>plain</p>')).toEqual([]);
  });
});

describe('remoteAssetReferences', () => {
  test('reports remote scripts and stylesheets', () => {
    expect(remoteAssetReferences('<script src="https://cdn.example/x.js"></script>')).toEqual([
      'https://cdn.example/x.js',
    ]);
    expect(remoteAssetReferences('<link rel="stylesheet" href="//fonts.example/x.css">')).toEqual([
      '//fonts.example/x.css',
    ]);
  });

  test('reports remote icon links', () => {
    expect(remoteAssetReferences('<link rel="icon" href="https://cdn.example/i.png">')).toEqual([
      'https://cdn.example/i.png',
    ]);
  });

  test('ignores local assets and asset tags without a source', () => {
    expect(remoteAssetReferences('<img alt="x"><script src="/canto-data/app.js">')).toEqual([]);
    expect(remoteAssetReferences('<link rel="icon" href="/canto-data/favicon.png">')).toEqual([]);
  });

  test('ignores non-asset links such as canonical URLs', () => {
    expect(remoteAssetReferences('<link rel="canonical" href="https://x.example/">')).toEqual([]);
    expect(remoteAssetReferences('<link href="/canto-data/x.css">')).toEqual([]);
    expect(remoteAssetReferences('<link rel="icon">')).toEqual([]);
  });
});

describe('resolveHref', () => {
  test('skips empty, fragment, mail and external links', () => {
    for (const href of [
      '',
      '   ',
      '#anchor',
      'mailto:a@b.example',
      'https://x.example/',
      '//x.example/',
    ]) {
      expect(resolveHref(href, '')).toBeNull();
    }
    expect(resolveHref('?q=1', '')).toBeNull();
  });

  test('maps base-prefixed links to dist files', () => {
    expect(resolveHref('/canto-data/', '')).toBe('index.html');
    expect(resolveHref('/canto-data/usage/', '')).toBe('usage/index.html');
    expect(resolveHref('/canto-data/api', '')).toBe('api/index.html');
    expect(resolveHref('/canto-data/favicon.png?v=1', '')).toBe('favicon.png');
    expect(resolveHref('/canto-data/_astro/app.css#x', '')).toBe('_astro/app.css');
    expect(resolveHref('./', '')).toBe('index.html');
    expect(resolveHref('.', '')).toBe('index.html');
  });

  test('resolves relative links against the page route', () => {
    expect(resolveHref('deep/', 'usage/')).toBe('usage/deep/index.html');
    expect(resolveHref('../api/', 'usage/deep/')).toBe('usage/api/index.html');
  });

  test('refuses links outside the site base', () => {
    expect(() => resolveHref('/elsewhere/', '')).toThrow(/outside the site base/);
  });
});

describe('readVersion', () => {
  test('reads the manifest version', () => {
    const io = fakeIo({ files: { [path.join(ROOT, 'package.json')]: '{"version":"1.2.1"}' } });
    expect(readVersion(io, ROOT)).toBe('1.2.1');
  });

  test('reports unreadable and versionless manifests', () => {
    const broken = fakeIo({
      files: { [path.join(ROOT, 'package.json')]: 'not json' },
    });
    expect(() => readVersion(broken, ROOT)).toThrow(/cannot read/);
    const versionless = fakeIo({ files: { [path.join(ROOT, 'package.json')]: '{}' } });
    expect(() => readVersion(versionless, ROOT)).toThrow(/has no version/);
    const empty = fakeIo({ files: { [path.join(ROOT, 'package.json')]: '{"version":""}' } });
    expect(() => readVersion(empty, ROOT)).toThrow(/has no version/);
  });
});

describe('checkBuiltSite', () => {
  test('accepts a complete site', () => {
    const io = fakeIo({ files: pageFiles('1.2.1') });
    expect(checkBuiltSite(io, ROOT, '1.2.1')).toEqual([]);
  });

  test('ignores links that need no check', () => {
    const files = pageFiles('1.2.1');
    files[path.join(DIST, 'api/index.html')] =
      '<a href="https://x.example/">x</a><a href="#top">t</a>';
    expect(checkBuiltSite(fakeIo({ files }), ROOT, '1.2.1')).toEqual([]);
  });

  test('reports a missing marker file and missing pages', () => {
    const io = fakeIo({
      files: pageFiles('1.2.1'),
      missing: [path.join(DIST, '.nojekyll'), path.join(DIST, 'api/index.html')],
    });
    expect(checkBuiltSite(io, ROOT, '1.2.1')).toEqual([
      'docs/page/dist/.nojekyll is missing',
      'missing page api/index.html',
    ]);
  });

  test('reports a landing page without the version marker', () => {
    const files = pageFiles('1.2.1');
    files[path.join(DIST, 'index.html')] = '<p>no version</p>';
    expect(checkBuiltSite(fakeIo({ files }), ROOT, '1.2.1')).toEqual([
      'landing page does not display version v1.2.1',
    ]);
  });

  test('reports a missing landing page without a version complaint', () => {
    const files = pageFiles('1.2.1');
    for (const key of Object.keys(files)) {
      if (key.includes('/docs/page/dist/')) files[key] = '<p>x</p>';
    }
    delete files[path.join(DIST, 'index.html')];
    expect(checkBuiltSite(fakeIo({ files }), ROOT, '1.2.1')).toEqual(['missing page index.html']);
  });

  test('reports remote assets, broken links and out-of-base links', () => {
    const files = pageFiles('1.2.1');
    files[path.join(DIST, 'usage/index.html')] =
      '<script src="https://cdn.example/x.js"></script>' +
      '<a href="/canto-data/missing/">m</a>' +
      '<a href="/elsewhere/">e</a>';
    expect(checkBuiltSite(fakeIo({ files }), ROOT, '1.2.1')).toEqual([
      "remote asset 'https://cdn.example/x.js' in usage/index.html",
      "usage/index.html: broken link '/canto-data/missing/' -> missing/index.html",
      "usage/index.html: internal link '/elsewhere/' is outside the site base /canto-data/",
    ]);
  });
});

describe('createDocs', () => {
  test('builds and verifies the site', () => {
    const io = fakeIo({ files: pageFiles('1.2.1') });
    expect(createDocs(io).run(['--root', ROOT])).toBe(0);
    expect(io.run).toHaveBeenCalledWith(process.execPath, [
      path.join(ROOT, 'node_modules/astro/bin/astro.mjs'),
      'build',
      '--root',
      'docs/page',
    ]);
    expect(io.log).toHaveBeenCalledWith(
      'docs-build: 10 page(s) verified under /canto-data/ (version 1.2.1)',
    );
  });

  test('fails when arguments are missing or astro is not installed', () => {
    const io = fakeIo({});
    expect(createDocs(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringMatching(/^docs-build: missing --root/));
    const noAstro = fakeIo({
      files: { [path.join(ROOT, 'package.json')]: '{"version":"1.2.1"}' },
    });
    expect(createDocs(noAstro).run(['--root', ROOT])).toBe(1);
    expect(noAstro.error).toHaveBeenCalledWith('docs-build: astro is not installed; run make deps');
  });

  test('reports build failures from stderr, then stdout', () => {
    const stderrIo = fakeIo({
      files: pageFiles('1.2.1'),
      runResult: { status: 1, stdout: '', stderr: 'astro exploded' },
    });
    expect(createDocs(stderrIo).run(['--root', ROOT])).toBe(1);
    expect(stderrIo.error).toHaveBeenCalledWith('docs-build: astro build failed: astro exploded');
    const stdoutIo = fakeIo({
      files: pageFiles('1.2.1'),
      runResult: { status: 1, stdout: 'stdout detail', stderr: '' },
    });
    expect(createDocs(stdoutIo).run(['--root', ROOT])).toBe(1);
    expect(stdoutIo.error).toHaveBeenCalledWith('docs-build: astro build failed: stdout detail');
  });

  test('reports verification problems and command failures', () => {
    const files = pageFiles('1.2.1');
    delete files[path.join(DIST, 'schema/index.html')];
    const io = fakeIo({ files });
    expect(createDocs(io).run(['--root', ROOT])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('docs-build: 1 problem(s)');
    expect(io.error).toHaveBeenCalledWith('  - missing page schema/index.html');
    const throwing = fakeIo({
      files: pageFiles('1.2.1'),
      runThrows: new Error("could not run 'node': boom"),
    });
    expect(createDocs(throwing).run(['--root', ROOT])).toBe(1);
    expect(throwing.error).toHaveBeenCalledWith("docs-build: could not run 'node': boom");
  });
});
