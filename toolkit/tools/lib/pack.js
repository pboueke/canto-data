'use strict';

/** Files consumers must receive, relative to the package root inside the tarball. */
const REQUIRED = [
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/dist/index.js',
  'package/dist/index.d.ts',
  'package/dist/types.js',
  'package/dist/types.d.ts',
  'package/dist/format.js',
  'package/dist/format.d.ts',
  'package/dist/version.js',
  'package/dist/version.d.ts',
  'package/dist/validation.js',
  'package/dist/validation.d.ts',
  'package/dist/migration.js',
  'package/dist/migration.d.ts',
  'package/dist/migrations/index.js',
  'package/dist/migrations/v0_16_0_to_v0_17_0.js',
  'package/dist/migrations/v0_17_0_to_v0_18_0.js',
  'package/dist/migrations/v0_18_0_to_v0_19_0.js',
];

/** Repository-only material that must never ship to consumers. */
const FORBIDDEN_PREFIXES = [
  'package/src/',
  'package/toolkit/',
  'package/docs/',
  'package/scripts/',
  'package/coverage/',
  'package/.github/',
  'package/.husky/',
  'package/.githooks/',
  'package/node_modules/',
];

const FORBIDDEN_SUFFIXES = ['.tgz', '.test.js', '.test.ts'];
const FORBIDDEN_EXACT = ['package/package-lock.json', 'package/release.sh'];

function parseTarList(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function parsePackageJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`package.json inside the tarball is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
}

function inspectListing(entries, pkg) {
  const violations = [];
  const set = new Set(entries);

  for (const required of REQUIRED) {
    if (!set.has(required)) violations.push(`missing required file ${required}`);
  }
  for (const entry of entries) {
    if (FORBIDDEN_PREFIXES.some((prefix) => entry.startsWith(prefix))) {
      violations.push(`forbidden repository path shipped: ${entry}`);
    }
    if (FORBIDDEN_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
      violations.push(`forbidden test/archive file shipped: ${entry}`);
    }
    if (FORBIDDEN_EXACT.includes(entry)) {
      violations.push(`forbidden file shipped: ${entry}`);
    }
  }
  if (pkg.name !== 'canto-data')
    violations.push(`package name is '${pkg.name}', expected 'canto-data'`);
  if (pkg.license !== 'MIT') violations.push(`license is '${pkg.license}', expected 'MIT'`);
  if (typeof pkg.version !== 'string' || pkg.version === '')
    violations.push('package version is missing');
  const runtimeDependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
  if (runtimeDependencies.length > 0) {
    violations.push(`runtime dependencies are not zero: ${runtimeDependencies.join(', ')}`);
  }
  return violations;
}

function createPackCheck(io) {
  function run(argv) {
    try {
      const tarball = (argv.find((arg) => !arg.startsWith('--')) ?? '').trim();
      if (tarball === '') throw new Error('usage: pack-check <tarball>');

      const listing = io.run('tar', ['-tzf', tarball]);
      if (listing.status !== 0) {
        throw new Error(`could not list tarball '${tarball}': ${listing.stderr || listing.stdout}`);
      }
      const entries = parseTarList(listing.stdout);
      if (entries.length === 0) throw new Error(`tarball '${tarball}' is empty`);

      const manifest = io.run('tar', ['-xOzf', tarball, 'package/package.json']);
      if (manifest.status !== 0) {
        throw new Error(
          `tarball has no package/package.json: ${manifest.stderr || manifest.stdout}`,
        );
      }
      const pkg = parsePackageJson(manifest.stdout);

      const violations = inspectListing(entries, pkg);
      const checksum = io.run('sha256sum', [tarball]);
      if (checksum.status !== 0) {
        throw new Error(`could not checksum tarball: ${checksum.stderr || checksum.stdout}`);
      }
      const digest = checksum.stdout.trim().split(/\s+/)[0];

      if (violations.length > 0) {
        io.error(`pack-check: ${violations.length} tarball violation(s):`);
        for (const violation of violations) io.error(`  - ${violation}`);
        return 1;
      }
      io.log(`pack-check: ${entries.length} files, zero runtime dependencies, sha256 ${digest}`);
      return 0;
    } catch (error) {
      io.error(`pack-check: ${error.message}`);
      return 1;
    }
  }

  return { run, inspectListing, parseTarList, parsePackageJson };
}

module.exports = { createPackCheck, REQUIRED, FORBIDDEN_PREFIXES };
