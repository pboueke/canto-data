'use strict';

const path = require('node:path');
const { parseArgs } = require('./args');
const { actualBump, compareVersions, requiredBump, topEntry } = require('./changelog');

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, { cause: error });
  }
}

function readJson(io, file) {
  return parseJson(io.readFileSync(file), file);
}

function writeJson(io, file, value) {
  io.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readmeVersionBadge(readme) {
  const match = /version-(\d+\.\d+\.\d+)-/.exec(readme);
  return match ? match[1] : null;
}

/** Read every place that must agree on the authored package version. */
function collectState(io, root, ref) {
  const read = (file) => {
    if (!ref) return io.readFileSync(path.join(root, file));
    const result = io.run('git', ['-C', root, 'show', `${ref}:${file}`]);
    if (result.status !== 0) {
      throw new Error(
        `cannot read ${file} at '${ref}': ${(result.stderr || result.stdout).trim()}`,
      );
    }
    return result.stdout;
  };

  const changelogText = read('CHANGELOG.md');
  const pkg = parseJson(read('package.json'), 'package.json');
  const lock = parseJson(read('package-lock.json'), 'package-lock.json');
  const readme = read('README.md');
  const lockRoot = lock.packages && lock.packages[''] ? lock.packages[''].version : null;

  return {
    changelogText,
    changelog: topEntry(changelogText).version,
    packageJson: pkg.version,
    packageLock: lock.version,
    packageLockRoot: lockRoot,
    readme: readmeVersionBadge(readme),
  };
}

/** Every version carrier must equal the changelog's authored version. */
function consistencyViolations(state) {
  const violations = [];
  const expected = state.changelog;
  const carriers = [
    ['package.json', state.packageJson],
    ['package-lock.json version', state.packageLock],
    ['package-lock.json packages[""].version', state.packageLockRoot],
    ['README.md version badge', state.readme],
  ];
  for (const [label, value] of carriers) {
    if (value !== expected) {
      violations.push(
        `${label} is ${value === null ? 'missing' : `'${value}'`} but CHANGELOG.md declares '${expected}' — run make version-sync`,
      );
    }
  }
  return violations;
}

/** The release-note bump must match the version advance since the base. */
function deltaViolations(baseText, headText) {
  const head = topEntry(headText);
  const base = topEntry(baseText);
  const comparison = compareVersions(head.version, base.version);

  if (comparison === 0) return [];
  if (comparison < 0) {
    return [
      `CHANGELOG.md top version ${head.version} is older than the base version ${base.version}; release versions advance monotonically`,
    ];
  }

  const required = requiredBump(head.notes);
  const applied = actualBump(base.version, head.version);
  if (required !== applied) {
    return [
      `release ${head.version} applies a ${applied} bump but its typed notes require ${required} (breaking → major, feat → minor, otherwise patch)`,
    ];
  }
  return [];
}

/**
 * Version gate: enforce one authored version across the changelog, package
 * manifests and README, and validate the bump against the typed notes added
 * since an explicitly resolved base. A missing base fails closed.
 */
function createVersionCheck(io) {
  function validate({ root, base }) {
    let head;
    try {
      head = collectState(io, root, '');
    } catch (error) {
      return [`cannot read the working-tree version state: ${error.message}`];
    }

    const violations = consistencyViolations(head);
    if (!base) {
      violations.push(
        'no version comparison base was resolved; pass --base <ref> so the check cannot silently disable',
      );
      return violations;
    }

    let baseState;
    try {
      baseState = collectState(io, root, base);
    } catch (error) {
      violations.push(`cannot resolve version base '${base}': ${error.message}`);
      return violations;
    }

    try {
      violations.push(...deltaViolations(baseState.changelogText, head.changelogText));
    } catch (error) {
      violations.push(error.message);
    }
    return violations;
  }

  function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['root']);
    } catch (error) {
      io.error(`version-check: ${error.message}`);
      return 1;
    }
    const base = args.base ?? '';
    const violations = validate({ root: args.root, base });
    if (violations.length > 0) {
      io.error(`version-check: ${violations.length} problem(s)`);
      for (const violation of violations) io.error(`  - ${violation}`);
      return 1;
    }
    io.log(`version-check: CHANGELOG, package.json, lockfile and README agree (base ${base})`);
    return 0;
  }

  return { run, validate, collectState };
}

/** Rewrite every carrier to the changelog's authored version. */
function createVersionSync(io) {
  function sync({ root }) {
    const changelogText = io.readFileSync(path.join(root, 'CHANGELOG.md'));
    const target = topEntry(changelogText).version;
    const changed = [];

    const packagePath = path.join(root, 'package.json');
    const pkg = readJson(io, packagePath);
    if (pkg.version !== target) {
      pkg.version = target;
      writeJson(io, packagePath, pkg);
      changed.push('package.json');
    }

    const lockPath = path.join(root, 'package-lock.json');
    const lock = readJson(io, lockPath);
    let lockChanged = false;
    if (lock.version !== target) {
      lock.version = target;
      lockChanged = true;
    }
    if (lock.packages && lock.packages[''] && lock.packages[''].version !== target) {
      lock.packages[''].version = target;
      lockChanged = true;
    }
    if (lockChanged) {
      writeJson(io, lockPath, lock);
      changed.push('package-lock.json');
    }

    const readmePath = path.join(root, 'README.md');
    const readme = io.readFileSync(readmePath);
    if (!/version-\d+\.\d+\.\d+-/.test(readme)) {
      throw new Error('README.md has no version badge to update');
    }
    const updated = readme.replace(/version-\d+\.\d+\.\d+-/, `version-${target}-`);
    if (updated !== readme) {
      io.writeFileSync(readmePath, updated);
      changed.push('README.md');
    }

    return { target, changed };
  }

  function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['root']);
    } catch (error) {
      io.error(`version-sync: ${error.message}`);
      return 1;
    }
    try {
      const { target, changed } = sync({ root: args.root });
      if (changed.length > 0) {
        io.log(`version-sync: set ${target} in ${changed.join(', ')} (nothing was staged)`);
      } else {
        io.log(`version-sync: all carriers already at ${target}`);
      }
      return 0;
    } catch (error) {
      io.error(`version-sync: ${error.message}`);
      return 1;
    }
  }

  return { run, sync };
}

module.exports = {
  createVersionCheck,
  createVersionSync,
  collectState,
  readmeVersionBadge,
  parseJson,
};
