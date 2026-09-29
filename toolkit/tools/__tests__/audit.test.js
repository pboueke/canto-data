'use strict';

const { createAudit, defaultExceptionsPath, registryErrorDetail } = require('../lib/audit');

const NOW = new Date('2026-01-15T00:00:00.000Z');

function reportOf(vulnerabilities) {
  return JSON.stringify({ auditReportVersion: 2, vulnerabilities });
}

function fakeIo(overrides = {}) {
  return {
    run: jest.fn().mockReturnValue({ status: 1, stdout: reportOf({}), stderr: '' }),
    readFileSync: jest.fn().mockReturnValue('[]'),
    now: () => NOW,
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

describe('defaultExceptionsPath', () => {
  test('points at the committed exception list', () => {
    expect(defaultExceptionsPath()).toBe(
      require('node:path').join(__dirname, '..', 'audit', 'exceptions.json'),
    );
  });
});

describe('parseAuditReport', () => {
  const { parseAuditReport } = createAudit(fakeIo());

  test('accepts a report with a vulnerabilities object', () => {
    expect(parseAuditReport(reportOf({ left: { severity: 'high' } }), '')).toEqual({
      auditReportVersion: 2,
      vulnerabilities: { left: { severity: 'high' } },
    });
  });

  test('rejects non-JSON output with the stderr detail', () => {
    expect(() => parseAuditReport('not json', 'registry down')).toThrow(/registry down/);
  });

  test('falls back to stdout when stderr is empty', () => {
    expect(() => parseAuditReport('not json', '')).toThrow(/not json/);
  });

  test('rejects a non-object report', () => {
    expect(() => parseAuditReport('[]', '')).toThrow(/not an object/);
  });

  test('rejects a registry error report', () => {
    expect(() => parseAuditReport('{"error":{"message":"ENOTFOUND"}}', '')).toThrow(
      /npm audit failed: ENOTFOUND/,
    );
  });

  test('describes registry errors by summary, code, then fallback', () => {
    expect(registryErrorDetail({ summary: 'This command requires a lockfile' })).toBe(
      'This command requires a lockfile',
    );
    expect(registryErrorDetail({ code: 'ENOLOCK' })).toBe('ENOLOCK');
    expect(registryErrorDetail({})).toBe('unknown registry error');
    expect(registryErrorDetail({ message: '' })).toBe('unknown registry error');
  });

  test('rejects a report without vulnerabilities', () => {
    expect(() => parseAuditReport('{"auditReportVersion":2}', '')).toThrow(
      /missing vulnerabilities/,
    );
  });
});

describe('loadExceptions', () => {
  const { loadExceptions } = createAudit(fakeIo());

  test('accepts a valid exception entry', () => {
    const entry = { advisoryId: 123, reason: 'not reachable', expires: '2026-06-01' };
    expect(loadExceptions(JSON.stringify([entry]))).toEqual([entry]);
  });

  test('accepts a string advisory id', () => {
    expect(
      loadExceptions('[{"advisoryId":"GHSA-x","reason":"r","expires":"1 Jan 2027"}]'),
    ).toHaveLength(1);
  });

  test('rejects invalid JSON and keeps the cause', () => {
    expect(() => loadExceptions('{oops')).toThrow(/not valid JSON/);
  });

  test('rejects a non-array document', () => {
    expect(() => loadExceptions('{}')).toThrow(/must be a JSON array/);
  });

  test('rejects entries that are not objects', () => {
    expect(() => loadExceptions('["nope"]')).toThrow(/#1 must be an object/);
    expect(() => loadExceptions('[[1]]')).toThrow(/#1 must be an object/);
  });

  test('requires an advisoryId', () => {
    expect(() => loadExceptions('[{"reason":"r","expires":"2027-01-01"}]')).toThrow(
      /needs an advisoryId/,
    );
  });

  test('requires a non-empty reason', () => {
    expect(() => loadExceptions('[{"advisoryId":1,"reason":"  ","expires":"2027-01-01"}]')).toThrow(
      /needs a reason/,
    );
  });

  test('requires a valid expiry', () => {
    expect(() => loadExceptions('[{"advisoryId":1,"reason":"r","expires":"never"}]')).toThrow(
      /needs an expiry date/,
    );
  });
});

describe('advisoryIds', () => {
  const { advisoryIds } = createAudit(fakeIo());

  test('collects numeric and string sources from via objects', () => {
    expect(
      advisoryIds({ via: [{ source: 1 }, { source: 'GHSA-2' }, 'dep-name', {}, null] }),
    ).toEqual(['1', 'GHSA-2']);
  });

  test('returns nothing when via is absent', () => {
    expect(advisoryIds({})).toEqual([]);
  });
});

describe('findViolations', () => {
  const { findViolations } = createAudit(fakeIo());

  test('flags an uncovered HIGH vulnerability', () => {
    const report = { vulnerabilities: { left: { severity: 'high', via: [{ source: 7 }] } } };
    expect(findViolations(report, [], NOW)).toEqual([
      { name: 'left', severity: 'high', ids: ['7'], range: undefined, expired: [] },
    ]);
  });

  test('accepts an unexpired exception', () => {
    const report = { vulnerabilities: { left: { severity: 'critical', via: [{ source: 7 }] } } };
    const exceptions = [{ advisoryId: 7, reason: 'r', expires: '2026-06-01' }];
    expect(findViolations(report, exceptions, NOW)).toEqual([]);
  });

  test('treats an expired exception as no exception', () => {
    const report = { vulnerabilities: { left: { severity: 'high', via: [{ source: 7 }] } } };
    const exceptions = [{ advisoryId: 7, reason: 'r', expires: '2025-06-01' }];
    expect(findViolations(report, exceptions, NOW)).toEqual([
      { name: 'left', severity: 'high', ids: ['7'], range: undefined, expired: ['2025-06-01'] },
    ]);
  });

  test('ignores moderate and unknown severities', () => {
    const report = {
      vulnerabilities: { left: { severity: 'moderate' }, right: {} },
    };
    expect(findViolations(report, [], NOW)).toEqual([]);
  });
});

describe('createAudit().run', () => {
  test('passes when there are no violations', async () => {
    const io = fakeIo();
    await expect(createAudit(io).run()).resolves.toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      'audit: no HIGH/CRITICAL vulnerabilities without a valid exception',
    );
  });

  test('fails with the singular message for one violation', async () => {
    const io = fakeIo({
      run: jest.fn().mockReturnValue({
        status: 1,
        stdout: reportOf({ left: { severity: 'high', via: [{ source: 7 }] } }),
        stderr: '',
      }),
    });
    await expect(createAudit(io).run()).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      'audit: 1 HIGH/CRITICAL vulnerability without a valid exception:',
    );
    expect(io.error).toHaveBeenCalledWith('  - left [high] advisory 7');
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('upgrade the dependency'));
  });

  test('fails with the plural message and expired detail for several violations', async () => {
    const io = fakeIo({
      run: jest.fn().mockReturnValue({
        status: 1,
        stdout: reportOf({
          left: { severity: 'high', via: [{ source: 7 }] },
          right: { severity: 'critical' },
        }),
        stderr: '',
      }),
      readFileSync: jest
        .fn()
        .mockReturnValue('[{"advisoryId":7,"reason":"r","expires":"2025-01-01"}]'),
    });
    await expect(createAudit(io).run()).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      'audit: 2 HIGH/CRITICAL vulnerabilities without a valid exception:',
    );
    expect(io.error).toHaveBeenCalledWith(
      '  - left [high] advisory 7 (exception expired 2025-01-01)',
    );
    expect(io.error).toHaveBeenCalledWith('  - right [critical] advisory unknown');
  });

  test('fails closed when the audit command cannot start', async () => {
    const io = fakeIo({
      run: jest.fn(() => {
        throw new Error('could not run npm');
      }),
    });
    await expect(createAudit(io).run()).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith('audit: could not run npm');
  });

  test('fails closed on a malformed report', async () => {
    const io = fakeIo({
      run: jest.fn().mockReturnValue({ status: 0, stdout: 'no json', stderr: '' }),
    });
    await expect(createAudit(io).run()).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('did not produce a JSON report'));
  });

  test('fails closed on malformed exceptions', async () => {
    const io = fakeIo({ readFileSync: jest.fn().mockReturnValue('{"not":"an array"}') });
    await expect(createAudit(io).run()).resolves.toBe(1);
    expect(io.error).toHaveBeenCalledWith('audit: audit exceptions must be a JSON array');
  });
});
