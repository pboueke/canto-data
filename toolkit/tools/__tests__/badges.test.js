'use strict';

const { createBadges, coverageColor, readBadges, readReports } = require('../lib/badges');

const GOOD_README = [
  '![Version](https://img.shields.io/badge/version-1.0.5-green)',
  '![Tests](https://img.shields.io/badge/tests-320%2F320%20passed-brightgreen)',
  '![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)',
  '',
].join('\n');

function reports({ passed = 320, total = 320, failed = 0, pct = 100 } = {}) {
  return {
    summary: JSON.stringify({ total: { statements: { pct } } }),
    results: JSON.stringify({
      numPassedTests: passed,
      numTotalTests: total,
      numFailedTests: failed,
    }),
  };
}

function fakeIo({ readme = GOOD_README, reportFiles = reports(), missing = [] } = {}) {
  const files = {
    'coverage/coverage-summary.json': reportFiles.summary,
    'coverage/jest-results.json': reportFiles.results,
    'README.md': readme,
  };
  return {
    readFileSync: jest.fn((file) => {
      const key = Object.keys(files).find((candidate) => file.endsWith(candidate));
      if (!key) throw new Error(`no such file: ${file}`);
      return files[key];
    }),
    writeFileSync: jest.fn((file, contents) => {
      const key = Object.keys(files).find((candidate) => file.endsWith(candidate));
      if (key) files[key] = contents;
    }),
    existsSync: jest.fn((file) => !missing.some((entry) => file.endsWith(entry))),
    log: jest.fn(),
    error: jest.fn(),
    files,
  };
}

describe('coverageColor', () => {
  test('keeps the existing thresholds', () => {
    expect(coverageColor(100)).toBe('brightgreen');
    expect(coverageColor(90)).toBe('brightgreen');
    expect(coverageColor(89)).toBe('yellow');
    expect(coverageColor(70)).toBe('yellow');
    expect(coverageColor(69)).toBe('red');
  });
});

describe('readReports', () => {
  test('reads machine-readable counts and truncates the percentage', () => {
    const io = fakeIo({ reportFiles: reports({ pct: 99.58 }) });
    expect(readReports(io, '/repo')).toEqual({
      tests: { passed: 320, total: 320 },
      coverage: { percentage: 99, color: 'brightgreen' },
    });
  });

  test('fails closed when a report is missing', () => {
    const io = fakeIo({ missing: ['coverage-summary.json'] });
    expect(() => readReports(io, '/repo')).toThrow(/reports are missing; run make test/);
  });

  test('fails on invalid or shapeless reports', () => {
    expect(() =>
      readReports(fakeIo({ reportFiles: { summary: '{oops', results: '{}' } }), '/repo'),
    ).toThrow(/coverage summary is not readable JSON/);
    expect(() =>
      readReports(fakeIo({ reportFiles: { summary: '{}', results: '{oops' } }), '/repo'),
    ).toThrow(/jest results is not readable JSON/);
    expect(() =>
      readReports(fakeIo({ reportFiles: { summary: '{}', results: '{}' } }), '/repo'),
    ).toThrow(/no total\.statements\.pct/);
    expect(() =>
      readReports(
        fakeIo({ reportFiles: { summary: '{"total":{"statements":{"pct":100}}}', results: '{}' } }),
        '/repo',
      ),
    ).toThrow(/missing test counts/);
  });

  test('fails on failing or empty test runs', () => {
    expect(() => readReports(fakeIo({ reportFiles: reports({ failed: 2 }) }), '/repo')).toThrow(
      /2 failing test\(s\)/,
    );
    expect(() =>
      readReports(fakeIo({ reportFiles: reports({ passed: 0, total: 0 }) }), '/repo'),
    ).toThrow(/zero tests/);
  });
});

describe('readBadges', () => {
  test('extracts both badges', () => {
    expect(readBadges(GOOD_README)).toEqual({
      tests: { passed: 320, total: 320, color: 'brightgreen' },
      coverage: { percentage: 100, color: 'brightgreen' },
    });
  });

  test('returns nulls when badges are missing', () => {
    expect(readBadges('no badges')).toEqual({ tests: null, coverage: null });
  });
});

describe('createBadges().validateBadges', () => {
  test('passes when badges match the reports', () => {
    expect(createBadges(fakeIo()).validateBadges({ root: '/repo' })).toEqual([]);
  });

  test('turns missing reports into an actionable violation', () => {
    const io = fakeIo({ missing: ['jest-results.json'] });
    expect(createBadges(io).validateBadges({ root: '/repo' })).toEqual([
      'machine-readable test reports are missing; run make test first',
    ]);
  });

  test('reports missing badges', () => {
    const io = fakeIo({ readme: 'no badges here' });
    expect(createBadges(io).validateBadges({ root: '/repo' })).toEqual([
      'README.md has no tests badge — run make badges-sync',
      'README.md has no coverage badge — run make badges-sync',
    ]);
  });

  test('reports mismatched test counts and colors', () => {
    const io = fakeIo({
      readme: GOOD_README.replace(
        'tests-320%2F320%20passed-brightgreen',
        'tests-156%2F156%20passed-brightgreen',
      ),
    });
    expect(createBadges(io).validateBadges({ root: '/repo' })).toEqual([
      'tests badge is 156/156 but the report says 320/320 — run make badges-sync',
    ]);

    const badColor = fakeIo({
      readme: GOOD_README.replace('passed-brightgreen', 'passed-red'),
    });
    expect(createBadges(badColor).validateBadges({ root: '/repo' })).toEqual([
      "tests badge color is 'red' although every test passed — run make badges-sync",
    ]);
  });

  test('reports a coverage badge with the right number but a wrong color', () => {
    const io = fakeIo({
      reportFiles: reports({ pct: 87.4 }),
      readme: GOOD_README.replace('coverage-100%25-brightgreen', 'coverage-87%25-brightgreen'),
    });
    expect(createBadges(io).validateBadges({ root: '/repo' })).toEqual([
      'coverage badge is 87% (brightgreen) but the report says 87% (yellow) — run make badges-sync',
    ]);
  });

  test('reports a coverage mismatch with differing numbers', () => {
    const io = fakeIo({
      reportFiles: reports({ pct: 87.4 }),
      readme: GOOD_README.replace('coverage-100%25-brightgreen', 'coverage-99%25-yellow'),
    });
    expect(createBadges(io).validateBadges({ root: '/repo' })).toEqual([
      'coverage badge is 99% (yellow) but the report says 87% (yellow) — run make badges-sync',
    ]);
  });
});

describe('createBadges().run', () => {
  test('rejects bad arguments, reports violations and passes', () => {
    const io = fakeIo();
    expect(createBadges(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('badges-check: missing --root');

    const bad = fakeIo({ readme: 'no badges' });
    expect(createBadges(bad).run(['--root', '/repo'])).toBe(1);
    expect(bad.error).toHaveBeenCalledWith('badges-check: 2 problem(s)');

    const good = fakeIo();
    expect(createBadges(good).run(['--root', '/repo'])).toBe(0);
    expect(good.log).toHaveBeenCalledWith(
      'badges-check: README badges match the machine-readable test reports',
    );
  });
});

describe('createBadges().runSync', () => {
  test('rejects bad arguments and rewrites stale badges', () => {
    const io = fakeIo();
    expect(createBadges(io).runSync([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('badges-sync: missing --root');
  });

  test('writes the badges derived from the reports', () => {
    const io = fakeIo({
      readme: GOOD_README.replace(
        'tests-320%2F320%20passed-brightgreen',
        'tests-156%2F156%20passed-brightgreen',
      ),
    });
    expect(createBadges(io).runSync(['--root', '/repo'])).toBe(0);
    expect(io.files['README.md']).toContain('tests-320%2F320%20passed-brightgreen');
    expect(io.log).toHaveBeenCalledWith(
      'badges-sync: tests 320/320, coverage 100% (nothing was staged)',
    );
  });

  test('is idempotent when badges already match', () => {
    const io = fakeIo();
    expect(createBadges(io).runSync(['--root', '/repo'])).toBe(0);
    expect(io.writeFileSync).not.toHaveBeenCalled();
    expect(io.log).toHaveBeenCalledWith('badges-sync: README badges already match the reports');
  });

  test('fails when a badge is missing or reports are unreadable', () => {
    const missingBadge = fakeIo({ readme: 'no badges' });
    expect(createBadges(missingBadge).runSync(['--root', '/repo'])).toBe(1);
    expect(missingBadge.error).toHaveBeenCalledWith(
      'badges-sync: README.md is missing a tests or coverage badge',
    );

    const missingReports = fakeIo({ missing: ['jest-results.json'] });
    expect(createBadges(missingReports).runSync(['--root', '/repo'])).toBe(1);
    expect(missingReports.error).toHaveBeenCalledWith(
      expect.stringContaining('reports are missing'),
    );
  });
});
