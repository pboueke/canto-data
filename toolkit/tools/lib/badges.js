'use strict';

const path = require('node:path');
const { parseArgs } = require('./args');

const TESTS_BADGE = /tests-(\d+)%2F(\d+)%20passed-([a-z]+)/;
const COVERAGE_BADGE = /coverage-(\d+)%25-([a-z]+)/;

/** Badge colors keep the existing README grammar. */
function coverageColor(percentage) {
  if (percentage >= 90) return 'brightgreen';
  if (percentage >= 70) return 'yellow';
  return 'red';
}

function readJsonReport(io, file, label) {
  try {
    return JSON.parse(io.readFileSync(file));
  } catch (error) {
    throw new Error(`${label} is not readable JSON: ${error.message}`, { cause: error });
  }
}

/**
 * Read the machine-readable Jest reports written by `make test`. Badges only
 * follow successful runs, so failing or missing reports are hard errors.
 */
function readReports(io, root) {
  const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
  const resultsPath = path.join(root, 'coverage', 'jest-results.json');
  if (!io.existsSync(summaryPath) || !io.existsSync(resultsPath)) {
    throw new Error('machine-readable test reports are missing; run make test first');
  }

  const summary = readJsonReport(io, summaryPath, 'coverage summary');
  const results = readJsonReport(io, resultsPath, 'jest results');
  const pct =
    summary && summary.total && summary.total.statements ? summary.total.statements.pct : undefined;
  if (typeof pct !== 'number') {
    throw new Error('coverage summary has no total.statements.pct');
  }
  const { numPassedTests: passed, numTotalTests: total, numFailedTests: failed } = results;
  if (typeof passed !== 'number' || typeof total !== 'number' || typeof failed !== 'number') {
    throw new Error('jest results are missing test counts');
  }
  if (failed !== 0) {
    throw new Error(
      `jest results report ${failed} failing test(s); fix them before touching badges`,
    );
  }
  if (total === 0) {
    throw new Error('jest results report zero tests');
  }

  // Truncate rather than round so a badge can never overstate coverage.
  const percentage = Math.floor(pct);
  return {
    tests: { passed, total },
    coverage: { percentage, color: coverageColor(percentage) },
  };
}

function readBadges(readme) {
  const tests = TESTS_BADGE.exec(readme);
  const coverage = COVERAGE_BADGE.exec(readme);
  return {
    tests: tests ? { passed: Number(tests[1]), total: Number(tests[2]), color: tests[3] } : null,
    coverage: coverage ? { percentage: Number(coverage[1]), color: coverage[2] } : null,
  };
}

function badgeViolations(readme, reports) {
  const badges = readBadges(readme);
  const violations = [];

  if (!badges.tests) {
    violations.push('README.md has no tests badge — run make badges-sync');
  } else if (
    badges.tests.passed !== reports.tests.passed ||
    badges.tests.total !== reports.tests.total
  ) {
    violations.push(
      `tests badge is ${badges.tests.passed}/${badges.tests.total} but the report says ${reports.tests.passed}/${reports.tests.total} — run make badges-sync`,
    );
  } else if (badges.tests.color !== 'brightgreen') {
    violations.push(
      `tests badge color is '${badges.tests.color}' although every test passed — run make badges-sync`,
    );
  }

  if (!badges.coverage) {
    violations.push('README.md has no coverage badge — run make badges-sync');
  } else if (
    badges.coverage.percentage !== reports.coverage.percentage ||
    badges.coverage.color !== reports.coverage.color
  ) {
    violations.push(
      `coverage badge is ${badges.coverage.percentage}% (${badges.coverage.color}) but the report says ${reports.coverage.percentage}% (${reports.coverage.color}) — run make badges-sync`,
    );
  }

  return violations;
}

/**
 * Badge gate: derive test and coverage badges from machine-readable results,
 * never from console output, and fail closed when reports are missing.
 */
function createBadges(io) {
  /** Read reports + README and return violations (report errors become violations). */
  function validateBadges({ root }) {
    let reports;
    try {
      reports = readReports(io, root);
    } catch (error) {
      return [error.message];
    }
    const readme = io.readFileSync(path.join(root, 'README.md'));
    return badgeViolations(readme, reports);
  }

  function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['root']);
    } catch (error) {
      io.error(`badges-check: ${error.message}`);
      return 1;
    }
    const violations = validateBadges({ root: args.root });
    if (violations.length > 0) {
      io.error(`badges-check: ${violations.length} problem(s)`);
      for (const violation of violations) io.error(`  - ${violation}`);
      return 1;
    }
    io.log('badges-check: README badges match the machine-readable test reports');
    return 0;
  }

  function runSync(argv) {
    let args;
    try {
      args = parseArgs(argv, ['root']);
    } catch (error) {
      io.error(`badges-sync: ${error.message}`);
      return 1;
    }
    try {
      const root = args.root;
      const reports = readReports(io, root);
      const readmePath = path.join(root, 'README.md');
      const readme = io.readFileSync(readmePath);
      const badges = readBadges(readme);
      if (!badges.tests || !badges.coverage) {
        throw new Error('README.md is missing a tests or coverage badge');
      }
      const updated = readme
        .replace(
          TESTS_BADGE,
          `tests-${reports.tests.passed}%2F${reports.tests.total}%20passed-brightgreen`,
        )
        .replace(
          COVERAGE_BADGE,
          `coverage-${reports.coverage.percentage}%25-${reports.coverage.color}`,
        );
      if (updated !== readme) {
        io.writeFileSync(readmePath, updated);
        io.log(
          `badges-sync: tests ${reports.tests.passed}/${reports.tests.total}, coverage ${reports.coverage.percentage}% (nothing was staged)`,
        );
      } else {
        io.log('badges-sync: README badges already match the reports');
      }
      return 0;
    } catch (error) {
      io.error(`badges-sync: ${error.message}`);
      return 1;
    }
  }

  return { run, runSync, validateBadges, readReports, readBadges };
}

module.exports = { createBadges, readBadges, readReports, coverageColor };
