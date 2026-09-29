'use strict';

const {
  parseVersion,
  compareVersions,
  actualBump,
  parseChangelog,
  topEntry,
  classifyNote,
  requiredBump,
} = require('../lib/changelog');

describe('parseVersion and compareVersions', () => {
  test('parses X.Y.Z versions', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  test('rejects malformed versions', () => {
    expect(() => parseVersion('1.2')).toThrow(/invalid release version/);
    expect(() => parseVersion('v1.2.3')).toThrow(/invalid release version/);
  });

  test('orders versions', () => {
    expect(compareVersions('1.0.4', '1.0.5')).toBe(-1);
    expect(compareVersions('1.0.5', '1.0.5')).toBe(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });
});

describe('actualBump', () => {
  test('detects major, minor and patch advances', () => {
    expect(actualBump('1.0.4', '2.0.0')).toBe('major');
    expect(actualBump('1.0.4', '1.1.0')).toBe('minor');
    expect(actualBump('1.0.4', '1.0.5')).toBe('patch');
  });
});

describe('parseChangelog', () => {
  const text = [
    '# Changelog',
    '',
    '## v1.0.5 - Newest',
    '',
    '- feat: add a thing',
    '- fix: repair a thing',
    '',
    '## v1.0.4 - Older',
    '',
    '- chore: tidy up',
    '',
  ].join('\n');

  test('parses releases newest first with their notes', () => {
    const entries = parseChangelog(text);
    expect(entries.map((entry) => entry.version)).toEqual(['1.0.5', '1.0.4']);
    expect(entries[0].notes).toEqual(['- feat: add a thing', '- fix: repair a thing']);
    expect(entries[1].title).toBe('Older');
  });

  test('ignores loose prose outside releases', () => {
    expect(parseChangelog('no releases here')).toEqual([]);
  });

  test('returns the newest release or throws when there is none', () => {
    expect(topEntry(text).version).toBe('1.0.5');
    expect(() => topEntry('no releases here')).toThrow(/no "## vX\.Y\.Z - description" entry/);
  });
});

describe('classifyNote', () => {
  test('extracts typed notes', () => {
    expect(classifyNote('- feat: something')).toEqual({ type: 'feat', text: 'something' });
    expect(classifyNote('- chore: x')).toEqual({ type: 'chore', text: 'x' });
  });

  test('marks untyped notes', () => {
    expect(classifyNote('- just a note')).toEqual({ type: null, text: '- just a note' });
  });
});

describe('requiredBump', () => {
  test('rejects empty and untyped notes', () => {
    expect(() => requiredBump([])).toThrow(/no typed notes/);
    expect(() => requiredBump(['- no type here'])).toThrow(/untyped release note/);
  });

  test('breaking requires major', () => {
    expect(requiredBump(['- breaking: remove an export'])).toBe('major');
  });

  test('feat and feature require minor', () => {
    expect(requiredBump(['- fix: x', '- feat: y'])).toBe('minor');
    expect(requiredBump(['- feature: y'])).toBe('minor');
  });

  test('everything else requires a patch', () => {
    expect(requiredBump(['- chore: x', '- docs: y', '- ci: z'])).toBe('patch');
  });
});
