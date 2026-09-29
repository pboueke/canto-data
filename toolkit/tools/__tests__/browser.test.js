'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {
  createBrowserPrepare,
  createBrowserRun,
  entrySource,
  startServer,
  launchChromium,
  contentType,
  resolveRequestPath,
} = require('../lib/browser');

function fakeIo(overrides = {}) {
  return {
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    run: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode, body, headers: response.headers }),
        );
      })
      .on('error', reject);
  });
}

describe('entrySource', () => {
  test('generates only public-surface browser checks by default', () => {
    const source = entrySource(false);
    expect(source).toContain("from 'canto-data/format'");
    expect(source).not.toContain('deliberate browser failure');
  });

  test('injects a deliberate failure when asked', () => {
    expect(entrySource(true)).toContain("check('deliberate browser failure'");
  });
});

describe('contentType', () => {
  test('maps known extensions and falls back to octet-stream', () => {
    expect(contentType('index.html')).toBe('text/html; charset=utf-8');
    expect(contentType('app.js')).toBe('text/javascript; charset=utf-8');
    expect(contentType('data.json')).toBe('application/json; charset=utf-8');
    expect(contentType('app.js.map')).toBe('application/octet-stream');
  });
});

describe('startServer', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canto-data-browser-server-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'app.js'), 'window.ok = true;');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('serves the index, assets and a 404 for anything else', async () => {
    const server = await startServer(dir);
    try {
      const index = await get(`http://127.0.0.1:${server.port}/`);
      expect(index.status).toBe(200);
      expect(index.body).toBe('<html></html>');
      const asset = await get(`http://127.0.0.1:${server.port}/app.js?v=1`);
      expect(asset.status).toBe(200);
      expect(asset.headers['content-type']).toBe('text/javascript; charset=utf-8');
      const missing = await get(`http://127.0.0.1:${server.port}/missing.js`);
      expect(missing.status).toBe(404);
      const traversal = await get(`http://127.0.0.1:${server.port}/..%2fpackage.json`);
      expect(traversal.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  test('also rejects directories', async () => {
    fs.mkdirSync(path.join(dir, 'nested'));
    const server = await startServer(dir);
    try {
      const response = await get(`http://127.0.0.1:${server.port}/nested`);
      expect(response.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});

describe('launchChromium', () => {
  test('rejects when the browser binary is unavailable', async () => {
    await expect(
      launchChromium({ executablePath: '/nonexistent-chromium-binary' }),
    ).rejects.toThrow();
  });
});

describe('resolveRequestPath', () => {
  test('maps URLs, queries, slashes and missing values', () => {
    expect(resolveRequestPath(undefined)).toBe('index.html');
    expect(resolveRequestPath('')).toBe('index.html');
    expect(resolveRequestPath('/')).toBe('index.html');
    expect(resolveRequestPath('/app.js?v=1')).toBe('app.js');
    expect(resolveRequestPath('//nested/app.js')).toBe('nested/app.js');
  });
});

describe('createBrowserPrepare', () => {
  const ARGS = ['--tarball', '/pack/package.tgz', '--work', '/consumer', '--repo', '/work'];

  test('installs, writes the entry page and bundles it', () => {
    const io = fakeIo();
    expect(createBrowserPrepare(io).run(ARGS)).toBe(0);
    const files = io.writeFileSync.mock.calls.map(([file]) => file);
    expect(files).toEqual(
      expect.arrayContaining(['/consumer/entry.js', '/consumer/dist/index.html']),
    );
    expect(io.run).toHaveBeenCalledWith(
      '/work/node_modules/.bin/esbuild',
      expect.arrayContaining(['--bundle', '/consumer/entry.js', '--outfile=/consumer/dist/app.js']),
    );
    expect(io.log).toHaveBeenCalledWith(
      'browser-prepare: bundled the installed package (passing checks)',
    );
  });

  test('rejects bad arguments', () => {
    const io = fakeIo();
    expect(createBrowserPrepare(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-prepare: missing --tarball');
    expect(io.run).not.toHaveBeenCalled();
  });

  test('bundles deliberately failing checks when asked', () => {
    const io = fakeIo();
    expect(createBrowserPrepare(io).run([...ARGS, '--fail-check', 'true'])).toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      'browser-prepare: bundled the installed package (failing checks)',
    );
    const entry = io.writeFileSync.mock.calls.find(([file]) => file === '/consumer/entry.js');
    expect(entry[1]).toContain('deliberate browser failure');
  });

  test('fails when the install fails', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 1, stdout: '', stderr: 'npm exploded' })),
    });
    expect(createBrowserPrepare(io).run(ARGS)).toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-prepare: npm install failed: npm exploded');
  });

  test('fails when esbuild fails, using stdout when stderr is empty', () => {
    const io = fakeIo({
      run: jest.fn((command) =>
        command.endsWith('/esbuild')
          ? { status: 1, stdout: 'resolve failed', stderr: '' }
          : { status: 0, stdout: '', stderr: '' },
      ),
    });
    expect(createBrowserPrepare(io).run(ARGS)).toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-prepare: esbuild failed: resolve failed');
  });

  test('breaks the package entry point on request', () => {
    const io = fakeIo();
    expect(createBrowserPrepare(io).run([...ARGS, '--break-entry', 'true'])).toBe(0);
    expect(io.run).toHaveBeenCalledWith(
      'mv',
      ['/consumer/node_modules/canto-data/dist/index.js', '/consumer/index.js.bak'],
      { cwd: '/consumer' },
    );
  });

  test('fails when the entry point cannot be broken, falling back to stdout', () => {
    const io = fakeIo({
      run: jest.fn((command) =>
        command === 'mv'
          ? { status: 1, stdout: 'mv stdout detail', stderr: '' }
          : { status: 0, stdout: '', stderr: '' },
      ),
    });
    expect(createBrowserPrepare(io).run([...ARGS, '--break-entry', 'true'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      'browser-prepare: could not break the package entry point: mv stdout detail',
    );
  });
});

describe('createBrowserRun', () => {
  function fakes({ launchError, gotoError, evaluateError, evaluateResult, closeError } = {}) {
    const page = {
      goto: jest.fn(() => (gotoError ? Promise.reject(gotoError) : Promise.resolve())),
      evaluate: jest.fn(() => {
        if (evaluateError) return Promise.reject(evaluateError);
        return Promise.resolve(evaluateResult);
      }),
    };
    const browser = {
      newPage: jest.fn(() => Promise.resolve(page)),
      close: jest.fn(() => (closeError ? Promise.reject(closeError) : Promise.resolve())),
    };
    const server = { port: 4567, close: jest.fn(() => Promise.resolve()) };
    const io = fakeIo();
    const deps = {
      launch: jest.fn(() => (launchError ? Promise.reject(launchError) : Promise.resolve(browser))),
      startServer: jest.fn(() => Promise.resolve(server)),
    };
    return { io, deps, page, browser, server };
  }

  const ARGS = ['--consumer', '/consumer'];

  test('passes a successful in-page run and tears everything down', async () => {
    const { io, deps, page, browser, server } = fakes({
      evaluateResult: {
        ok: true,
        results: [
          { name: 'a', ok: true },
          { name: 'b', ok: true },
        ],
      },
    });
    await expect(createBrowserRun(io, deps).run(ARGS)).resolves.toBe(0);
    expect(deps.startServer).toHaveBeenCalledWith('/consumer/dist');
    expect(page.goto).toHaveBeenCalledWith('http://127.0.0.1:4567/index.html', expect.any(Object));
    expect(io.log).toHaveBeenCalledWith('browser-run: 2 checks passed in headless Chromium');
    expect(browser.close).toHaveBeenCalled();
    expect(server.close).toHaveBeenCalled();
  });

  test('rejects bad arguments before starting a server', async () => {
    const { io, deps } = fakes();
    await expect(createBrowserRun(io, deps).run([])).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-run: missing --consumer');
    expect(deps.startServer).not.toHaveBeenCalled();
  });

  test('fails when the local server cannot start', async () => {
    const { io, deps } = fakes();
    deps.startServer.mockRejectedValue(new Error('port busy'));
    await expect(createBrowserRun(io, deps).run(ARGS)).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      'browser-run: could not start the local server: port busy',
    );
  });

  test('fails when Chromium is unavailable and still closes the server', async () => {
    const { io, deps, server } = fakes({ launchError: new Error('Executable does not exist') });
    await expect(createBrowserRun(io, deps).run(ARGS)).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-run: Executable does not exist');
    expect(server.close).toHaveBeenCalled();
  });

  test('reports in-page check failures with names and messages', async () => {
    const { io, deps, browser, server } = fakes({
      evaluateResult: {
        ok: false,
        results: [
          { name: 'good', ok: true },
          {
            name: 'deliberate browser failure',
            ok: false,
            message: 'deliberate assertion failure',
          },
        ],
      },
    });
    await expect(createBrowserRun(io, deps).run(ARGS)).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-run: in-page checks failed (1)');
    expect(io.error).toHaveBeenCalledWith(
      '  - deliberate browser failure: deliberate assertion failure',
    );
    expect(browser.close).toHaveBeenCalled();
    expect(server.close).toHaveBeenCalled();
  });

  test('fails when the page never returns results', async () => {
    const { io, deps } = fakes({ evaluateResult: undefined });
    await expect(createBrowserRun(io, deps).run(ARGS)).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith('browser-run: in-page checks failed (0)');
  });

  test('fails when navigation or evaluation throws and tolerates a failing close', async () => {
    const navigation = fakes({ gotoError: new Error('nav timeout') });
    await expect(createBrowserRun(navigation.io, navigation.deps).run(ARGS)).resolves.toBe(1);
    expect(navigation.io.error).toHaveBeenCalledWith('browser-run: nav timeout');

    const evaluation = fakes({
      evaluateError: new Error('evaluate failed'),
      closeError: new Error('close failed'),
    });
    await expect(createBrowserRun(evaluation.io, evaluation.deps).run(ARGS)).resolves.toBe(1);
    expect(evaluation.io.error).toHaveBeenCalledWith('browser-run: evaluate failed');
    expect(evaluation.server.close).toHaveBeenCalled();
  });

  test('executes the real evaluate callback against the page global', async () => {
    const { io, deps, page } = fakes();
    globalThis.window = {
      __runChecks: jest.fn(() => ({ ok: true, results: [{ name: 'real', ok: true }] })),
    };
    page.evaluate.mockImplementation((fn) => Promise.resolve(fn()));
    try {
      await expect(createBrowserRun(io, deps).run(ARGS)).resolves.toBe(0);
      expect(globalThis.window.__runChecks).toHaveBeenCalledTimes(1);
    } finally {
      delete globalThis.window;
    }
  });

  test('uses the real launcher and server when no fakes are injected', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canto-data-browser-real-'));
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<html></html>');
    const io = fakeIo();
    try {
      await expect(createBrowserRun(io).run(['--consumer', dir])).resolves.toBe(1);
      expect(io.error).toHaveBeenCalledWith(expect.stringContaining('browser-run:'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
