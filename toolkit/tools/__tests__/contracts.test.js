'use strict';

const { createContracts, toComparable, describeError, matchesError } = require('../lib/contracts');

function fakeApi(overrides = {}) {
  return {
    validateJournalContent: (value) => value,
    validatePage: (value) => value,
    isJournalContent: () => true,
    isPage: () => true,
    parseManifest: (json) => ({ json }),
    migrateIfNeeded: (data, fromVersion) => ({
      data,
      migrated: false,
      fromVersion: fromVersion ?? '0.16.0',
      toVersion: '0.17.0',
    }),
    collectAttachmentEntries: (pages) => pages,
    rewriteAttachmentPaths: (pages) => pages,
    serializePages: (pages) => new Map(pages.map((page) => [page.id, JSON.stringify(page)])),
    deserializePages: (entries) => [...entries.values()].map((json) => JSON.parse(json)),
    ...overrides,
  };
}

function fakeIo({ files = {}, exists = true, api } = {}) {
  return {
    existsSync: () => exists,
    readdirSync: () => Object.keys(files),
    readFileSync: (file) => {
      const key = Object.keys(files).find((candidate) => file.endsWith(candidate));
      if (!key) throw new Error(`unexpected read: ${file}`);
      return files[key];
    },
    loadModule: () => api,
    api,
    log: jest.fn(),
    error: jest.fn(),
  };
}

const FIXTURES_DIR = '/fixtures/contract';

describe('toComparable', () => {
  test('converts nested Maps, arrays and objects', () => {
    const inner = new Map([['b', [1, { c: 2 }]]]);
    const outer = new Map([['a', inner]]);
    expect(toComparable(outer)).toEqual({ a: { b: [1, { c: 2 }] } });
  });

  test('passes primitives through', () => {
    expect(toComparable('x')).toBe('x');
    expect(toComparable(null)).toBeNull();
  });
});

describe('describeError', () => {
  test('describes a plain error', () => {
    expect(describeError(new Error('boom'))).toEqual({ name: 'Error', message: 'boom' });
  });

  test('includes validation fields when present', () => {
    const error = Object.assign(new Error('bad'), {
      name: 'ValidationError',
      field: 'page.id',
      expected: 'string',
      received: 'number',
    });
    expect(describeError(error)).toEqual({
      name: 'ValidationError',
      message: 'bad',
      field: 'page.id',
      expected: 'string',
      received: 'number',
    });
  });

  test('describes a non-error thrown value', () => {
    expect(describeError('plain string')).toEqual({
      name: 'ThrownValue',
      message: 'plain string',
    });
  });
});

describe('matchesError', () => {
  const actual = { name: 'ValidationError', message: 'bad page', field: 'page.id' };

  test('matches on name alone', () => {
    expect(matchesError(actual, { name: 'ValidationError' })).toBe(true);
  });

  test('rejects a different name', () => {
    expect(matchesError(actual, { name: 'Error' })).toBe(false);
  });

  test('rejects a different message and accepts messageContains', () => {
    expect(matchesError(actual, { name: 'ValidationError', message: 'other' })).toBe(false);
    expect(matchesError(actual, { name: 'ValidationError', messageContains: 'bad page' })).toBe(
      true,
    );
    expect(matchesError(actual, { name: 'ValidationError', messageContains: 'missing' })).toBe(
      false,
    );
  });

  test('rejects mismatched validation fields', () => {
    expect(matchesError(actual, { name: 'ValidationError', field: 'page.text' })).toBe(false);
    expect(
      matchesError(actual, { name: 'ValidationError', expected: 'string', received: 'number' }),
    ).toBe(false);
  });
});

describe('loadFixtures', () => {
  const { loadFixtures } = createContracts(fakeIo());

  function load(content) {
    return loadFixtures(FIXTURES_DIR, fakeIo({ files: { 'cases.json': content } }));
  }

  test('fails when the fixture directory is missing', () => {
    expect(() => loadFixtures(FIXTURES_DIR, fakeIo({ exists: false }))).toThrow(
      /fixture directory .* does not exist/,
    );
  });

  test('fails when no JSON fixtures exist', () => {
    expect(() => loadFixtures(FIXTURES_DIR, fakeIo({ files: {} }))).toThrow(/no JSON fixtures/);
  });

  test('fails on invalid JSON with the file name', () => {
    expect(() => load('{oops')).toThrow(/cases\.json: not valid JSON/);
  });

  test('fails on a fixture that is not an object', () => {
    expect(() => load('["nope"]')).toThrow(/cases\.json#1: fixture must be an object/);
  });

  test('fails on a missing name', () => {
    expect(() =>
      load('[{"operation":"isPage","input":{},"expect":{"ok":true,"value":true}}]'),
    ).toThrow(/needs a non-empty name/);
  });

  test('fails on an unknown operation', () => {
    expect(() =>
      load('[{"name":"x","operation":"explode","input":{},"expect":{"ok":true,"value":true}}]'),
    ).toThrow(/unknown operation 'explode'/);
  });

  test('fails when input is absent', () => {
    expect(() =>
      load('[{"name":"x","operation":"isPage","expect":{"ok":true,"value":true}}]'),
    ).toThrow(/fixture needs an input/);
  });

  test('fails when expect is absent', () => {
    expect(() => load('[{"name":"x","operation":"isPage","input":{}}]')).toThrow(
      /fixture needs an expect object/,
    );
  });

  test('fails when expect.ok is not boolean', () => {
    expect(() => load('[{"name":"x","operation":"isPage","input":{},"expect":{}}]')).toThrow(
      /expect\.ok must be a boolean/,
    );
  });

  test('fails when a failing fixture has no error expectation', () => {
    expect(() =>
      load('[{"name":"x","operation":"isPage","input":{},"expect":{"ok":false}}]'),
    ).toThrow(/failing fixtures need expect\.error/);
  });

  test('fails when a passing fixture has no value expectation', () => {
    expect(() =>
      load('[{"name":"x","operation":"isPage","input":{},"expect":{"ok":true}}]'),
    ).toThrow(/passing fixtures need expect\.value/);
  });

  test('accepts a single case object and an array of cases', () => {
    const single = load(
      '{"name":"x","operation":"isPage","input":{},"expect":{"ok":true,"value":true}}',
    );
    expect(single).toHaveLength(1);
    const many = load(
      '[{"name":"x","operation":"isPage","input":{},"expect":{"ok":true,"value":true}},{"name":"y","operation":"isPage","input":{},"expect":{"ok":true,"value":true}}]',
    );
    expect(many).toHaveLength(2);
    expect(many[1].file).toContain('(y)');
  });
});

describe('runFixture and checkFixture', () => {
  const { runFixture, checkFixture } = createContracts(fakeIo());

  test('records success values through Maps', () => {
    const result = runFixture(
      { operation: 'serializePagesRoundTrip', input: [{ id: 'p' }] },
      fakeApi(),
    );
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ entries: { p: { id: 'p' } }, restored: [{ id: 'p' }] });
  });

  test('records failures with described errors', () => {
    const result = runFixture(
      { operation: 'parseManifest', input: { json: 'x' } },
      fakeApi({
        parseManifest: () => {
          const error = Object.assign(new Error('bad'), { name: 'ValidationError', field: 'f' });
          throw error;
        },
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: { name: 'ValidationError', message: 'bad', field: 'f' },
    });
  });

  test('passes a matching value and fails a mismatch', () => {
    expect(
      checkFixture(
        { operation: 'isPage', input: {}, expect: { ok: true, value: true } },
        fakeApi(),
      ),
    ).toBeNull();
    expect(
      checkFixture(
        { operation: 'isPage', input: {}, expect: { ok: true, value: false } },
        fakeApi(),
      ),
    ).toMatch(/value mismatch/);
  });

  test('supports the $input identity expectation', () => {
    expect(
      checkFixture(
        {
          operation: 'validatePage',
          input: { value: { a: 1 }, path: 'page' },
          expect: { ok: true, value: '$input' },
        },
        fakeApi({ validatePage: (value) => value }),
      ),
    ).toMatch(/value mismatch/);
  });

  test('fails when success was expected but the call threw', () => {
    expect(
      checkFixture(
        { operation: 'isPage', input: {}, expect: { ok: true, value: true } },
        fakeApi({
          isPage: () => {
            throw new Error('nope');
          },
        }),
      ),
    ).toMatch(/expected success but threw Error: nope/);
  });

  test('fails when a failure was expected but the call succeeded', () => {
    expect(
      checkFixture(
        {
          operation: 'isPage',
          input: {},
          expect: { ok: false, error: { name: 'ValidationError' } },
        },
        fakeApi(),
      ),
    ).toMatch(/expected ValidationError but the call succeeded/);
  });

  test('fails when the thrown error does not match', () => {
    expect(
      checkFixture(
        {
          operation: 'isPage',
          input: {},
          expect: { ok: false, error: { name: 'ValidationError' } },
        },
        fakeApi({
          isPage: () => {
            throw new TypeError('different');
          },
        }),
      ),
    ).toMatch(/error mismatch/);
  });

  test('passes when the thrown error matches', () => {
    expect(
      checkFixture(
        { operation: 'isPage', input: {}, expect: { ok: false, error: { name: 'TypeError' } } },
        fakeApi({
          isPage: () => {
            throw new TypeError('different');
          },
        }),
      ),
    ).toBeNull();
  });
});

describe('fixture operations', () => {
  const { runFixture } = createContracts(fakeIo());

  function apiWith(overrides = {}) {
    return {
      validateJournalContent: jest.fn(() => 'journal'),
      validatePage: jest.fn(() => 'page'),
      validateChunkedAttachmentContent: jest.fn(() => 'content'),
      isJournalContent: jest.fn(() => true),
      isPage: jest.fn(() => true),
      isChunkedAttachmentContent: jest.fn(() => true),
      parseManifest: jest.fn(() => 'manifest'),
      migrateIfNeeded: jest.fn(() => 'migrated'),
      collectAttachmentEntries: jest.fn(() => 'attachments'),
      rewriteAttachmentPaths: jest.fn(() => 'rewritten'),
      serializePages: jest.fn(() => new Map([['p', '{"id":"p"}']])),
      deserializePages: jest.fn(() => ['deserialized']),
      ...overrides,
    };
  }

  test('validateJournalContent forwards the raw input', () => {
    const api = apiWith();
    expect(runFixture({ operation: 'validateJournalContent', input: { a: 1 } }, api).value).toBe(
      'journal',
    );
    expect(api.validateJournalContent).toHaveBeenCalledWith({ a: 1 });
  });

  test('isJournalContentGuard forwards the raw input', () => {
    const api = apiWith();
    expect(runFixture({ operation: 'isJournalContentGuard', input: {} }, api).value).toBe(true);
    expect(api.isJournalContent).toHaveBeenCalledWith({});
  });

  test('guardAndValidatePage records agreement', () => {
    const result = runFixture({ operation: 'guardAndValidatePage', input: {} }, apiWith());
    expect(result.value).toEqual({
      guard: true,
      valid: true,
      errorName: null,
      errorField: null,
    });
  });

  test('guardAndValidatePage records the validator field path', () => {
    const api = apiWith({
      validatePage: () => {
        throw Object.assign(new Error('bad'), { name: 'ValidationError', field: 'page.id' });
      },
    });
    expect(runFixture({ operation: 'guardAndValidatePage', input: {} }, api).value).toEqual({
      guard: true,
      valid: false,
      errorName: 'ValidationError',
      errorField: 'page.id',
    });
  });

  test('guardAndValidatePage tolerates errors without a field', () => {
    const api = apiWith({
      validatePage: () => {
        throw new TypeError('nope');
      },
    });
    expect(runFixture({ operation: 'guardAndValidatePage', input: {} }, api).value).toEqual({
      guard: true,
      valid: false,
      errorName: 'TypeError',
      errorField: null,
    });
  });

  test('validateChunkedAttachmentContent forwards value and path', () => {
    const api = apiWith();
    runFixture(
      {
        operation: 'validateChunkedAttachmentContent',
        input: { value: { format: 'x' }, path: 'p' },
      },
      api,
    );
    expect(api.validateChunkedAttachmentContent).toHaveBeenCalledWith({ format: 'x' }, 'p');
  });

  test('isChunkedAttachmentContentGuard forwards the raw descriptor', () => {
    const api = apiWith();
    expect(
      runFixture({ operation: 'isChunkedAttachmentContentGuard', input: { format: 'x' } }, api)
        .value,
    ).toBe(true);
    expect(api.isChunkedAttachmentContent).toHaveBeenCalledWith({ format: 'x' });
  });

  test('guardAndValidateChunkedAttachmentContent records agreement and failures', () => {
    expect(
      runFixture({ operation: 'guardAndValidateChunkedAttachmentContent', input: {} }, apiWith())
        .value,
    ).toEqual({ guard: true, valid: true, errorName: null, errorField: null });
    const fieldApi = apiWith({
      validateChunkedAttachmentContent: () => {
        throw Object.assign(new Error('bad'), {
          name: 'ValidationError',
          field: 'content.chunkCount',
        });
      },
    });
    expect(
      runFixture({ operation: 'guardAndValidateChunkedAttachmentContent', input: {} }, fieldApi)
        .value,
    ).toEqual({
      guard: true,
      valid: false,
      errorName: 'ValidationError',
      errorField: 'content.chunkCount',
    });
    const noFieldApi = apiWith({
      validateChunkedAttachmentContent: () => {
        throw new TypeError('nope');
      },
    });
    expect(
      runFixture({ operation: 'guardAndValidateChunkedAttachmentContent', input: {} }, noFieldApi)
        .value,
    ).toEqual({ guard: true, valid: false, errorName: 'TypeError', errorField: null });
  });

  test('guardAndValidateJournalContent records agreement and disagreement', () => {
    expect(
      runFixture({ operation: 'guardAndValidateJournalContent', input: {} }, apiWith()).value,
    ).toEqual({ guard: true, valid: true, errorName: null, errorField: null });
    const api = apiWith({
      validateJournalContent: () => {
        throw Object.assign(new Error('bad'), { name: 'ValidationError', field: 'x' });
      },
    });
    expect(
      runFixture({ operation: 'guardAndValidateJournalContent', input: {} }, api).value,
    ).toEqual({ guard: true, valid: false, errorName: 'ValidationError', errorField: 'x' });
    const noFieldApi = apiWith({
      validateJournalContent: () => {
        throw new TypeError('nope');
      },
    });
    expect(
      runFixture({ operation: 'guardAndValidateJournalContent', input: {} }, noFieldApi).value,
    ).toEqual({ guard: true, valid: false, errorName: 'TypeError', errorField: null });
  });

  test('migrateIfNeeded splits data and fromVersion', () => {
    const api = apiWith();
    runFixture(
      { operation: 'migrateIfNeeded', input: { data: { d: 1 }, fromVersion: '0.16.0' } },
      api,
    );
    expect(api.migrateIfNeeded).toHaveBeenCalledWith({ d: 1 }, '0.16.0');
  });

  test('collectAttachmentEntries forwards the page list', () => {
    const api = apiWith();
    runFixture({ operation: 'collectAttachmentEntries', input: [1, 2] }, api);
    expect(api.collectAttachmentEntries).toHaveBeenCalledWith([1, 2]);
  });

  test('rewriteAttachmentPaths rebuilds the path Map', () => {
    const api = apiWith();
    runFixture(
      { operation: 'rewriteAttachmentPaths', input: { pages: [1], pathMap: { a: 'b' } } },
      api,
    );
    const [, pathMap] = api.rewriteAttachmentPaths.mock.calls[0];
    expect(pathMap instanceof Map).toBe(true);
    expect(pathMap.get('a')).toBe('b');
  });

  test('serializePagesRoundTrip turns invalid serialization into a failure', () => {
    const api = apiWith({ serializePages: () => new Map([['p', 'not json']]) });
    const result = runFixture({ operation: 'serializePagesRoundTrip', input: [] }, api);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain("invalid JSON for page 'p'");
  });

  test('deserializePages rebuilds the entries Map', () => {
    const api = apiWith();
    const result = runFixture({ operation: 'deserializePages', input: { x: '{}' } }, api);
    expect(result.value).toEqual(['deserialized']);
    const [entries] = api.deserializePages.mock.calls[0];
    expect(entries instanceof Map).toBe(true);
    expect(entries.get('x')).toBe('{}');
  });
});

describe('the contract gate', () => {
  test('passes every fixture and reports the count', () => {
    const api = fakeApi();
    const io = fakeIo({
      api,
      files: {
        'ok.json': JSON.stringify({
          name: 'page guard',
          operation: 'isPage',
          input: {},
          expect: { ok: true, value: true },
        }),
      },
    });
    const contracts = createContracts(io);
    expect(contracts.run()).toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      'contract-check: 1 fixtures match the reviewed public contract',
    );
  });

  test('loads the built API through io.loadModule when no api override is given', () => {
    const api = fakeApi();
    const io = fakeIo({
      files: {
        'ok.json': JSON.stringify({
          name: 'page guard',
          operation: 'isPage',
          input: {},
          expect: { ok: true, value: true },
        }),
      },
    });
    io.api = undefined;
    const loadModule = jest.fn(() => api);
    io.loadModule = loadModule;
    expect(createContracts(io).run()).toBe(0);
    expect(loadModule).toHaveBeenCalledWith(expect.stringContaining('dist/index.js'));
  });

  test('fails, naming each fixture, when any expectation drifts', () => {
    const io = fakeIo({
      api: fakeApi(),
      files: {
        'drift.json': JSON.stringify([
          {
            name: 'page guard',
            operation: 'isPage',
            input: {},
            expect: { ok: true, value: false },
          },
          {
            name: 'page guard second',
            operation: 'isPage',
            input: {},
            expect: { ok: true, value: true },
          },
        ]),
      },
    });
    expect(createContracts(io).run()).toBe(1);
    expect(io.error).toHaveBeenCalledWith('contract-check: 1 of 2 fixtures failed');
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('drift.json#1 (page guard)'));
  });

  test('fails closed when fixture loading itself fails', () => {
    const io = fakeIo({ exists: false, api: fakeApi() });
    expect(createContracts(io).run()).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });
});
