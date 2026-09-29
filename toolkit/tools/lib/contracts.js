'use strict';

const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

/** Operations a fixture may exercise. Each receives the package API and input. */
const OPERATIONS = {
  validateJournalContent: (api, input) => api.validateJournalContent(input),
  validatePage: (api, input) => api.validatePage(input.value, input.path),
  isJournalContentGuard: (api, input) => api.isJournalContent(input),
  isPage: (api, input) => api.isPage(input),
  guardAndValidatePage: (api, input) => {
    try {
      api.validatePage(input);
      return { guard: api.isPage(input), valid: true, errorName: null, errorField: null };
    } catch (error) {
      return {
        guard: api.isPage(input),
        valid: false,
        errorName: error.name,
        errorField: typeof error.field === 'string' ? error.field : null,
      };
    }
  },
  validateChunkedAttachmentContent: (api, input) =>
    api.validateChunkedAttachmentContent(input.value, input.path),
  isChunkedAttachmentContentGuard: (api, input) => api.isChunkedAttachmentContent(input),
  guardAndValidateChunkedAttachmentContent: (api, input) => {
    try {
      api.validateChunkedAttachmentContent(input);
      return {
        guard: api.isChunkedAttachmentContent(input),
        valid: true,
        errorName: null,
        errorField: null,
      };
    } catch (error) {
      return {
        guard: api.isChunkedAttachmentContent(input),
        valid: false,
        errorName: error.name,
        errorField: typeof error.field === 'string' ? error.field : null,
      };
    }
  },
  guardAndValidateJournalContent: (api, input) => {
    try {
      api.validateJournalContent(input);
      return { guard: api.isJournalContent(input), valid: true, errorName: null, errorField: null };
    } catch (error) {
      return {
        guard: api.isJournalContent(input),
        valid: false,
        errorName: error.name,
        errorField: typeof error.field === 'string' ? error.field : null,
      };
    }
  },
  parseManifest: (api, input) => api.parseManifest(input.json),
  migrateIfNeeded: (api, input) => api.migrateIfNeeded(input.data, input.fromVersion),
  collectAttachmentEntries: (api, input) => api.collectAttachmentEntries(input),
  rewriteAttachmentPaths: (api, input) =>
    api.rewriteAttachmentPaths(input.pages, new Map(Object.entries(input.pathMap))),
  serializePagesRoundTrip: (api, input) => {
    const serialized = api.serializePages(input);
    const parsed = {};
    for (const [id, json] of serialized.entries()) {
      parsed[id] = parseSerializedPage(json, id);
    }
    return { entries: parsed, restored: api.deserializePages(serialized) };
  },
  deserializePages: (api, input) => api.deserializePages(new Map(Object.entries(input))),
};

/** Parse one serialized page, turning invalid output into a contract failure. */
function parseSerializedPage(json, id) {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`serializePages produced invalid JSON for page '${id}'`, { cause: error });
  }
}

/** Convert Maps and class instances into plain JSON-comparable values. */
function toComparable(value) {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, item]) => [key, toComparable(item)]));
  }
  if (Array.isArray(value)) {
    return value.map(toComparable);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = toComparable(item);
    }
    return out;
  }
  return value;
}

/** A stable, assertion-friendly description of a thrown value. */
function describeError(error) {
  if (error && typeof error === 'object' && typeof error.name === 'string') {
    const described = { name: error.name, message: String(error.message) };
    for (const field of ['field', 'expected', 'received']) {
      if (typeof error[field] !== 'undefined') described[field] = error[field];
    }
    return described;
  }
  return { name: 'ThrownValue', message: String(error) };
}

function matchesError(actual, expected) {
  if (actual.name !== expected.name) return false;
  if (typeof expected.message !== 'undefined' && actual.message !== expected.message) return false;
  if (
    typeof expected.messageContains === 'string' &&
    !actual.message.includes(expected.messageContains)
  ) {
    return false;
  }
  for (const field of ['field', 'expected', 'received']) {
    if (typeof expected[field] !== 'undefined' && actual[field] !== expected[field]) return false;
  }
  return true;
}

function validateFixtureCase(fixture, label) {
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new Error(`${label}: fixture must be an object`);
  }
  if (typeof fixture.name !== 'string' || fixture.name.trim() === '') {
    throw new Error(`${label}: fixture needs a non-empty name`);
  }
  if (typeof fixture.operation !== 'string' || !(fixture.operation in OPERATIONS)) {
    throw new Error(`${label}: unknown operation '${fixture.operation}'`);
  }
  if (!('input' in fixture)) {
    throw new Error(`${label}: fixture needs an input`);
  }
  if (!fixture.expect || typeof fixture.expect !== 'object' || Array.isArray(fixture.expect)) {
    throw new Error(`${label}: fixture needs an expect object`);
  }
  if (typeof fixture.expect.ok !== 'boolean') {
    throw new Error(`${label}: expect.ok must be a boolean`);
  }
  if (fixture.expect.ok === false && !fixture.expect.error) {
    throw new Error(`${label}: failing fixtures need expect.error`);
  }
  if (fixture.expect.ok === true && !('value' in fixture.expect)) {
    throw new Error(`${label}: passing fixtures need expect.value (use "$input" for identity)`);
  }
}

/** Load and shape-check every case in every JSON fixture under a directory. */
function loadFixtures(dir, io) {
  if (!io.existsSync(dir)) {
    throw new Error(`fixture directory '${dir}' does not exist`);
  }
  const files = io
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`no JSON fixtures under '${dir}'`);
  }
  const fixtures = [];
  for (const file of files) {
    const full = path.join(dir, file);
    let parsed;
    try {
      parsed = JSON.parse(io.readFileSync(full));
    } catch (error) {
      throw new Error(`${file}: not valid JSON: ${error.message}`, { cause: error });
    }
    const cases = Array.isArray(parsed) ? parsed : [parsed];
    for (const [index, fixture] of cases.entries()) {
      validateFixtureCase(fixture, `${file}#${index + 1}`);
      fixtures.push({ file: `${file}#${index + 1} (${fixture.name})`, fixture });
    }
  }
  return fixtures;
}

function runFixture(fixture, api) {
  try {
    return { ok: true, value: toComparable(OPERATIONS[fixture.operation](api, fixture.input)) };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

/** Return null when the fixture matches, or a human-readable failure. */
function checkFixture(fixture, api) {
  const result = runFixture(fixture, api);

  if (fixture.expect.ok) {
    if (!result.ok) {
      return `expected success but threw ${result.error.name}: ${result.error.message}`;
    }
    const expected =
      fixture.expect.value === '$input' ? toComparable(fixture.input) : fixture.expect.value;
    if (!isDeepStrictEqual(result.value, expected)) {
      return `value mismatch\n    expected ${JSON.stringify(expected)}\n    received ${JSON.stringify(result.value)}`;
    }
    return null;
  }

  if (result.ok) {
    return `expected ${fixture.expect.error.name} but the call succeeded`;
  }
  if (!matchesError(result.error, fixture.expect.error)) {
    return `error mismatch\n    expected ${JSON.stringify(fixture.expect.error)}\n    received ${JSON.stringify(result.error)}`;
  }
  return null;
}

/**
 * The contract gate: every committed fixture must exist, be well-formed and
 * match the reviewed behaviour of the built public API.
 */
function createContracts(io) {
  function run() {
    try {
      const fixturesDir =
        io.fixturesDir ?? path.join(__dirname, '..', '..', 'fixtures', 'contract');
      const fixtures = loadFixtures(fixturesDir, io);
      const api =
        io.api ?? io.loadModule(path.join(__dirname, '..', '..', '..', 'dist', 'index.js'));
      const failures = [];
      for (const { file, fixture } of fixtures) {
        const failure = checkFixture(fixture, api);
        if (failure) failures.push(`${file}: ${failure}`);
      }
      if (failures.length > 0) {
        io.error(`contract-check: ${failures.length} of ${fixtures.length} fixtures failed`);
        for (const failure of failures) io.error(`  - ${failure}`);
        return 1;
      }
      io.log(`contract-check: ${fixtures.length} fixtures match the reviewed public contract`);
      return 0;
    } catch (error) {
      io.error(`contract-check: ${error.message}`);
      return 1;
    }
  }

  return { run, loadFixtures, checkFixture, runFixture, describeError, toComparable };
}

module.exports = { createContracts, toComparable, describeError, matchesError };
