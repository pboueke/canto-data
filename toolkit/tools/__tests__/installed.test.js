'use strict';

const {
  createConsumerRun,
  createIntegration,
  installPackage,
  runLifecycle,
  FIXED_NOW,
} = require('../lib/installed');

function fakeIo(overrides = {}) {
  return {
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    run: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
    loadModule: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

function fakeApi(overrides = {}) {
  const SCHEMA_VERSION = '0.19.0';
  return {
    SCHEMA_VERSION,
    migrateIfNeeded(data, fromVersion = '0.16.0') {
      if (fromVersion === '0.20.0') {
        throw new Error(`Cannot open data with schema version ${fromVersion}`);
      }
      if (fromVersion === '0.15.0') {
        throw new Error(`No migration path from ${fromVersion} to ${SCHEMA_VERSION}`);
      }
      if (fromVersion === '0.19.0') {
        return { data, migrated: false, fromVersion, toVersion: SCHEMA_VERSION };
      }
      if (data && data.settings) delete data.settings.showMarkdownPlaceholder;
      return { data, migrated: true, fromVersion, toVersion: SCHEMA_VERSION };
    },
    validateJournalContent: (data) => data,
    collectAttachmentEntries: (pages) =>
      pages
        .flatMap((page) => [...page.images, ...page.files])
        .filter((attachment) => !attachment.deleted)
        .map((attachment) => ({
          zipFilename: `${attachment.type}-${attachment.id}.${attachment.name.split('.').pop()}`,
          diskPath: attachment.path,
          isPasswordEncrypted: attachment.encrypted,
        })),
    rewriteAttachmentPaths: (pages, pathMap) =>
      pages.map((page) => ({
        ...page,
        images: page.images.map((image) => ({
          ...image,
          path: pathMap.get(image.path) ?? image.path,
        })),
      })),
    serializePages: (pages) => new Map(pages.map((page) => [page.id, JSON.stringify(page)])),
    deserializePages: (entries) => [...entries.values()].map((json) => JSON.parse(json)),
    buildExportManifest: (options) => ({
      version: 1,
      schemaVersion: SCHEMA_VERSION,
      appVersion: options.appVersion,
      exportDate: new Date().toISOString(),
      encrypted: options.encrypted,
      journalTitle: options.journalTitle,
      ...(options.salt ? { salt: options.salt } : {}),
      ...(options.kdfIterations ? { kdfIterations: options.kdfIterations } : {}),
    }),
    parseManifest: (json) => JSON.parse(json),
    validatePage: (value) => {
      if (!value || typeof value.id !== 'string') {
        const error = new Error('invalid page');
        error.name = 'ValidationError';
        error.field = 'page.id';
        throw error;
      }
      return value;
    },
    ...overrides,
  };
}

describe('installPackage', () => {
  test('writes a pinned consumer manifest and installs the tarball', () => {
    const io = fakeIo();
    installPackage(io, '/consumer', '/pack/package.tgz', 'canto-data-consumer-24');
    const written = io.writeFileSync.mock.calls[0];
    expect(written[0]).toBe('/consumer/package.json');
    const manifest = JSON.parse(written[1]);
    expect(manifest.name).toBe('canto-data-consumer-24');
    expect(manifest.private).toBe(true);
    expect(manifest.devDependencies.typescript).toBe('5.9.3');
    expect(io.run).toHaveBeenCalledWith(
      'npm',
      ['install', '--no-audit', '--no-fund', '--ignore-scripts', '/pack/package.tgz'],
      { cwd: '/consumer' },
    );
  });

  test('throws when npm install fails', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 1, stdout: '', stderr: 'registry down' })),
    });
    expect(() => installPackage(io, '/consumer', '/pack/package.tgz', 'x')).toThrow(
      /npm install failed: registry down/,
    );
  });
});

describe('createConsumerRun', () => {
  function consumerIo({
    npmStatus = 0,
    stepStatus = 0,
    negativeStatus = 1,
    negativeOutput,
    failureToStdout = false,
  } = {}) {
    const failure = (detail) =>
      failureToStdout ? { stdout: detail, stderr: '' } : { stderr: detail, stdout: '' };
    const io = fakeIo({
      run: jest.fn((command, args) => {
        if (command === 'npm') {
          return {
            status: npmStatus,
            ...(npmStatus === 0 ? { stdout: '', stderr: '' } : failure('install failed')),
          };
        }
        if (command.endsWith('/.bin/tsc') && args[1] && args[1].includes('invalid')) {
          return {
            status: negativeStatus,
            stdout: negativeOutput ?? 'error TS2322: bad\nerror TS2739: incomplete',
            stderr: '',
          };
        }
        return {
          status: stepStatus,
          ...(stepStatus === 0 ? { stdout: '', stderr: '' } : failure('step failed')),
        };
      }),
    });
    return io;
  }

  test('writes every consumer check file', () => {
    const io = fakeIo();
    createConsumerRun(io).writeChecks(io, '/consumer');
    const files = io.writeFileSync.mock.calls.map(([file]) => file);
    expect(files).toEqual(
      expect.arrayContaining([
        '/consumer/checks/cjs.cjs',
        '/consumer/checks/esm.mjs',
        '/consumer/checks/types/root.ts',
        '/consumer/checks/types/subpaths.ts',
        '/consumer/checks/types/invalid.ts',
        '/consumer/checks/types/tsconfig.node.json',
        '/consumer/checks/types/tsconfig.node16.json',
        '/consumer/checks/types/tsconfig.bundler.json',
        '/consumer/checks/types/tsconfig.invalid.json',
      ]),
    );
  });

  test('accepts the expected negative diagnostics and rejects surprises', () => {
    const consumer = createConsumerRun(fakeIo());
    expect(consumer.negativeDiagnostics(consumerIo(), '/consumer')).toEqual({
      status: 0,
      message: '',
    });
    expect(
      consumer.negativeDiagnostics(consumerIo({ negativeStatus: 0 }), '/consumer').message,
    ).toMatch(/accepted the deliberately invalid/);
    expect(
      consumer.negativeDiagnostics(
        consumerIo({ negativeOutput: 'error TS2322: only' }),
        '/consumer',
      ).message,
    ).toMatch(/TS2739/);
    expect(
      consumer.negativeDiagnostics(
        consumerIo({ negativeOutput: 'error TS2307: cannot find module' }),
        '/consumer',
      ).message,
    ).toMatch(/TS2307/);
  });

  test('passes when every consumer leg succeeds', () => {
    const io = consumerIo();
    expect(
      createConsumerRun(io).run([
        '--tarball',
        '/p.tgz',
        '--work',
        '/consumer',
        '--node-version',
        '18',
      ]),
    ).toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      'consumer-run(node 18): CJS, ESM, declarations and negative diagnostics pass',
    );
  });

  test('rejects bad arguments before installing anything', () => {
    const io = consumerIo();
    expect(createConsumerRun(io).run(['--work', '/consumer'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('consumer-run: missing --tarball');
    expect(io.run).not.toHaveBeenCalled();
  });

  test('fails when the install fails', () => {
    const io = consumerIo({ npmStatus: 1 });
    expect(
      createConsumerRun(io).run([
        '--tarball',
        '/p.tgz',
        '--work',
        '/consumer',
        '--node-version',
        '18',
      ]),
    ).toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      'consumer-run(node 18): npm install failed: install failed',
    );
  });

  test('falls back to stdout when a failing tool writes nothing to stderr', () => {
    const installIo = consumerIo({ npmStatus: 1, failureToStdout: true });
    expect(
      createConsumerRun(installIo).run([
        '--tarball',
        '/p.tgz',
        '--work',
        '/consumer',
        '--node-version',
        '18',
      ]),
    ).toBe(1);
    expect(installIo.error).toHaveBeenCalledWith(
      'consumer-run(node 18): npm install failed: install failed',
    );

    const stepIo = consumerIo({ stepStatus: 1, failureToStdout: true });
    expect(
      createConsumerRun(stepIo).run([
        '--tarball',
        '/p.tgz',
        '--work',
        '/consumer',
        '--node-version',
        '18',
      ]),
    ).toBe(1);
    expect(stepIo.error).toHaveBeenCalledWith('step failed');
  });

  test('fails and prints output when a positive leg fails', () => {
    const io = consumerIo({ stepStatus: 1 });
    expect(
      createConsumerRun(io).run([
        '--tarball',
        '/p.tgz',
        '--work',
        '/consumer',
        '--node-version',
        '20',
      ]),
    ).toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      'consumer-run(node 20): cjs require root and subpaths failed (exit 1)',
    );
    expect(io.error).toHaveBeenCalledWith('step failed');
  });

  test('fails when the negative diagnostics are wrong', () => {
    const io = consumerIo({ negativeStatus: 0 });
    expect(
      createConsumerRun(io).run([
        '--tarball',
        '/p.tgz',
        '--work',
        '/consumer',
        '--node-version',
        '22',
      ]),
    ).toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      expect.stringContaining('negative declarations check failed'),
    );
  });
});

describe('withFixedClock', () => {
  test('controls the clock and restores it', () => {
    const RealDate = Date;
    const observed = createIntegration(fakeIo()).withFixedClock(FIXED_NOW, () => ({
      now: Date.now(),
      defaultDate: new Date().toISOString(),
      explicitDate: new Date(0).toISOString(),
    }));
    expect(observed.now).toBe(FIXED_NOW);
    expect(observed.defaultDate).toBe(new Date(FIXED_NOW).toISOString());
    expect(observed.explicitDate).toBe(new Date(0).toISOString());
    expect(Date).toBe(RealDate);
  });

  test('restores the clock when the body throws', () => {
    const RealDate = Date;
    expect(() =>
      createIntegration(fakeIo()).withFixedClock(FIXED_NOW, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(Date).toBe(RealDate);
  });
});

describe('runLifecycle', () => {
  test('passes against a correct implementation', () => {
    expect(runLifecycle(fakeApi())).toEqual([]);
  });

  test('records a failed migration', () => {
    const failures = runLifecycle(
      fakeApi({
        migrateIfNeeded: () => ({
          data: {},
          migrated: false,
          fromVersion: '0.16.0',
          toVersion: '0.19.0',
        }),
      }),
    );
    expect(failures.join('\n')).toMatch(/legacy migration/);
  });

  test('records failed validation', () => {
    const failures = runLifecycle(
      fakeApi({
        validateJournalContent: () => {
          throw new Error('bad journal');
        },
      }),
    );
    expect(failures.join('\n')).toMatch(/validation of migrated data: bad journal/);
  });

  test('records failed attachment mapping', () => {
    const failures = runLifecycle(fakeApi({ collectAttachmentEntries: () => [] }));
    expect(failures.join('\n')).toMatch(/attachment collection and path rewriting/);
  });

  test('records a failed serialization round trip', () => {
    const failures = runLifecycle(fakeApi({ deserializePages: () => [{ id: 'different' }] }));
    expect(failures.join('\n')).toMatch(/serialization round trip/);
  });

  test('records a wrong manifest', () => {
    const failures = runLifecycle(
      fakeApi({
        buildExportManifest: (options) => ({
          version: 1,
          schemaVersion: '9.9.9',
          appVersion: options.appVersion,
        }),
      }),
    );
    expect(failures.join('\n')).toMatch(
      /manifest construction and parsing with a controlled clock/,
    );
  });

  test('records missing error semantics', () => {
    const failures = runLifecycle(fakeApi({ validatePage: (value) => value }));
    expect(failures.join('\n')).toMatch(/validation errors keep their field details/);
  });
});

describe('createIntegration', () => {
  test('passes with the installed package API', () => {
    const io = fakeIo({ loadModule: jest.fn(() => fakeApi()) });
    expect(createIntegration(io).run(['--tarball', '/p.tgz', '--work', '/consumer'])).toBe(0);
    expect(io.loadModule).toHaveBeenCalledWith('/consumer/node_modules/canto-data');
    expect(io.log).toHaveBeenCalledWith(expect.stringContaining('installed-package migration'));
  });

  test('rejects bad arguments', () => {
    const io = fakeIo();
    expect(createIntegration(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('integration: missing --tarball');
  });

  test('fails when the installed package cannot be loaded', () => {
    const io = fakeIo({
      loadModule: jest.fn(() => {
        throw new Error('entry missing');
      }),
    });
    expect(createIntegration(io).run(['--tarball', '/p.tgz', '--work', '/consumer'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('integration: entry missing');
  });

  test('fails when the lifecycle does not hold', () => {
    const io = fakeIo({
      loadModule: jest.fn(() => fakeApi({ validatePage: (value) => value })),
    });
    expect(createIntegration(io).run(['--tarball', '/p.tgz', '--work', '/consumer'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('lifecycle check(s) failed'));
  });
});
