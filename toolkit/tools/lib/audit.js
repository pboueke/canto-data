'use strict';

const path = require('node:path');

const HIGH_SEVERITIES = new Set(['high', 'critical']);

/** The committed exception list of reviewed, expiring audit waivers. */
function defaultExceptionsPath() {
  return path.join(__dirname, '..', 'audit', 'exceptions.json');
}

/** npm audit error reports may carry message, summary or only a code. */
function registryErrorDetail(error) {
  for (const field of ['message', 'summary', 'code']) {
    if (typeof error[field] === 'string' && error[field] !== '') return error[field];
  }
  return 'unknown registry error';
}

/** Parse `npm audit --json` output, failing closed on anything unexpected. */
function parseAuditReport(stdout, stderr) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error(`npm audit did not produce a JSON report:\n${(stderr || stdout).trim()}`);
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('npm audit produced a malformed report (not an object)');
  }
  if (report.error) {
    throw new Error(`npm audit failed: ${registryErrorDetail(report.error)}`);
  }
  if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    throw new Error('npm audit produced a malformed report (missing vulnerabilities)');
  }
  return report;
}

/** Validate the exception file itself: every entry needs id, reason and expiry. */
function loadExceptions(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`audit exceptions are not valid JSON: ${error.message}`, { cause: error });
  }
  if (!Array.isArray(parsed)) {
    throw new Error('audit exceptions must be a JSON array');
  }
  for (const [index, entry] of parsed.entries()) {
    const at = `audit exception #${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${at} must be an object`);
    }
    if (typeof entry.advisoryId !== 'string' && typeof entry.advisoryId !== 'number') {
      throw new Error(`${at} needs an advisoryId`);
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(`${at} needs a reason`);
    }
    if (typeof entry.expires !== 'string' || Number.isNaN(Date.parse(entry.expires))) {
      throw new Error(`${at} needs an expiry date`);
    }
  }
  return parsed;
}

/** Advisory ids attached to a vulnerability entry by npm audit. */
function advisoryIds(vulnerability) {
  const ids = [];
  if (Array.isArray(vulnerability.via)) {
    for (const via of vulnerability.via) {
      if (via && typeof via === 'object' && via.source !== undefined) {
        ids.push(String(via.source));
      }
    }
  }
  return ids;
}

/** HIGH/CRITICAL vulnerabilities that no unexpired exception covers. */
function findViolations(report, exceptions, now) {
  const violations = [];
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    const severity =
      typeof vulnerability.severity === 'string' ? vulnerability.severity : 'unknown';
    if (!HIGH_SEVERITIES.has(severity)) continue;
    const ids = advisoryIds(vulnerability);
    const matching = exceptions.filter((entry) => ids.includes(String(entry.advisoryId)));
    const active = matching.some((entry) => Date.parse(entry.expires) > now.getTime());
    if (active) continue;
    violations.push({
      name,
      severity,
      ids,
      range: vulnerability.range,
      expired: matching.map((entry) => entry.expires),
    });
  }
  return violations;
}

/**
 * The audit gate: run `npm audit`, require a parsed report and a valid,
 * unexpired exception for every HIGH/CRITICAL finding. Registry failures,
 * malformed reports and expired exceptions fail closed.
 */
function createAudit(io) {
  async function run() {
    try {
      const result = io.run('npm', ['audit', '--json', '--audit-level=high']);
      const report = parseAuditReport(result.stdout, result.stderr);
      const exceptions = loadExceptions(io.readFileSync(defaultExceptionsPath()));
      const violations = findViolations(report, exceptions, io.now());

      if (violations.length > 0) {
        io.error(
          `audit: ${violations.length} HIGH/CRITICAL ${
            violations.length === 1 ? 'vulnerability' : 'vulnerabilities'
          } without a valid exception:`,
        );
        for (const violation of violations) {
          const expired = violation.expired.length
            ? ` (exception expired ${violation.expired.join(', ')})`
            : '';
          io.error(
            `  - ${violation.name} [${violation.severity}] advisory ${violation.ids.join(', ') || 'unknown'}${expired}`,
          );
        }
        io.error(
          'audit: upgrade the dependency or add a reviewed exception with advisoryId, reason and expiry',
        );
        return 1;
      }

      io.log('audit: no HIGH/CRITICAL vulnerabilities without a valid exception');
      return 0;
    } catch (error) {
      io.error(`audit: ${error.message}`);
      return 1;
    }
  }

  return { run, parseAuditReport, loadExceptions, advisoryIds, findViolations };
}

module.exports = { createAudit, defaultExceptionsPath, registryErrorDetail };
