'use strict';

const { createPackCheck, REQUIRED } = require('../lib/pack');

function ioWith({
  listing = '',
  manifest = '',
  checksum = '',
  listingStatus = 0,
  manifestStatus = 0,
  checksumStatus = 0,
  failureStream = 'stderr',
} = {}) {
  const failure = (detail) =>
    failureStream === 'stderr' ? { stderr: detail, stdout: '' } : { stderr: '', stdout: detail };
  return {
    run: jest.fn((command, args) => {
      if (command === 'tar' && args.includes('-tzf')) {
        return {
          status: listingStatus,
          ...(listingStatus === 0 ? { stdout: listing, stderr: '' } : failure('tar: no such file')),
        };
      }
      if (command === 'tar' && args.includes('-xOzf')) {
        return {
          status: manifestStatus,
          ...(manifestStatus === 0
            ? { stdout: manifest, stderr: '' }
            : failure('tar: no such entry')),
        };
      }
      if (command === 'sha256sum') {
        return {
          status: checksumStatus,
          ...(checksumStatus === 0 ? { stdout: checksum, stderr: '' } : failure('sha: no file')),
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    }),
    log: jest.fn(),
    error: jest.fn(),
  };
}

const GOOD_LISTING = `${REQUIRED.join('\n')}\npackage/dist/index.js.map\n`;
const GOOD_PACKAGE = JSON.stringify({ name: 'canto-data', version: '1.0.4', license: 'MIT' });

describe('parseTarList', () => {
  const { parseTarList } = createPackCheck({});

  test('trims and drops blank lines', () => {
    expect(parseTarList('package/a\n\n package/b \n')).toEqual(['package/a', 'package/b']);
  });
});

describe('parsePackageJson', () => {
  const { parsePackageJson } = createPackCheck({});

  test('parses valid JSON', () => {
    expect(parsePackageJson('{"name":"canto-data"}')).toEqual({ name: 'canto-data' });
  });

  test('wraps invalid JSON in an actionable error', () => {
    expect(() => parsePackageJson('{oops')).toThrow(/not valid JSON/);
  });
});

describe('inspectListing', () => {
  const { inspectListing } = createPackCheck({});

  test('accepts a complete package', () => {
    expect(inspectListing(REQUIRED, JSON.parse(GOOD_PACKAGE))).toEqual([]);
  });

  test('reports missing required files', () => {
    const violations = inspectListing(['package/package.json'], JSON.parse(GOOD_PACKAGE));
    expect(violations).toContain('missing required file package/dist/index.js');
  });

  test('reports forbidden repository paths and test artifacts', () => {
    const violations = inspectListing(
      [
        ...REQUIRED,
        'package/src/index.ts',
        'package/dist/x.test.js',
        'package/x.tgz',
        'package/package-lock.json',
        'package/release.sh',
      ],
      JSON.parse(GOOD_PACKAGE),
    );
    expect(violations).toContain('forbidden repository path shipped: package/src/index.ts');
    expect(violations).toContain('forbidden test/archive file shipped: package/dist/x.test.js');
    expect(violations).toContain('forbidden test/archive file shipped: package/x.tgz');
    expect(violations).toContain('forbidden file shipped: package/package-lock.json');
    expect(violations).toContain('forbidden file shipped: package/release.sh');
  });

  test('reports identity and runtime-dependency problems', () => {
    const violations = inspectListing(
      REQUIRED,
      JSON.parse(
        JSON.stringify({
          name: 'other',
          license: 'APACHE',
          version: '',
          dependencies: { left: '1.0.0' },
        }),
      ),
    );
    expect(violations).toContain("package name is 'other', expected 'canto-data'");
    expect(violations).toContain("license is 'APACHE', expected 'MIT'");
    expect(violations).toContain('package version is missing');
    expect(violations).toContain('runtime dependencies are not zero: left');
  });
});

describe('createPackCheck().run', () => {
  test('passes a compliant tarball and prints its checksum', () => {
    const io = ioWith({
      listing: GOOD_LISTING,
      manifest: GOOD_PACKAGE,
      checksum: 'abc123  /pack/package.tgz',
    });
    expect(createPackCheck(io).run(['/pack/package.tgz'])).toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      `pack-check: ${GOOD_LISTING.trim().split('\n').length} files, zero runtime dependencies, sha256 abc123`,
    );
  });

  test('requires a tarball argument', () => {
    const io = ioWith({});
    expect(createPackCheck(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('pack-check: usage: pack-check <tarball>');
  });

  test('fails when the tarball cannot be listed', () => {
    const io = ioWith({ listingStatus: 2, listing: '' });
    expect(createPackCheck(io).run(['/pack/missing.tgz'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('could not list tarball'));
  });

  test('fails on an empty listing', () => {
    const io = ioWith({ listing: '\n', manifest: GOOD_PACKAGE, checksum: 'x' });
    expect(createPackCheck(io).run(['/pack/package.tgz'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('is empty'));
  });

  test('fails when the manifest cannot be read', () => {
    const io = ioWith({ listing: GOOD_LISTING, manifestStatus: 2, checksum: 'x' });
    expect(createPackCheck(io).run(['/pack/package.tgz'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('no package/package.json'));
  });

  test('fails when the checksum cannot be computed', () => {
    const io = ioWith({ listing: GOOD_LISTING, manifest: GOOD_PACKAGE, checksumStatus: 2 });
    expect(createPackCheck(io).run(['/pack/package.tgz'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('could not checksum'));
  });

  test('falls back to stdout when a failing tool writes nothing to stderr', () => {
    const listing = ioWith({ listingStatus: 2, failureStream: 'stdout' });
    expect(createPackCheck(listing).run(['/p.tgz'])).toBe(1);
    expect(listing.error).toHaveBeenCalledWith(expect.stringContaining('tar: no such file'));

    const manifest = ioWith({ listing: GOOD_LISTING, manifestStatus: 2, failureStream: 'stdout' });
    expect(createPackCheck(manifest).run(['/p.tgz'])).toBe(1);
    expect(manifest.error).toHaveBeenCalledWith(expect.stringContaining('tar: no such entry'));

    const checksum = ioWith({
      listing: GOOD_LISTING,
      manifest: GOOD_PACKAGE,
      checksumStatus: 2,
      failureStream: 'stdout',
    });
    expect(createPackCheck(checksum).run(['/p.tgz'])).toBe(1);
    expect(checksum.error).toHaveBeenCalledWith(expect.stringContaining('sha: no file'));
  });

  test('fails with every violation listed', () => {
    const io = ioWith({
      listing: 'package/package.json\npackage/src/oops.ts\n',
      manifest: JSON.stringify({ name: 'canto-data', version: '1.0.0', license: 'MIT' }),
      checksum: 'abc  file',
    });
    expect(createPackCheck(io).run(['/pack/package.tgz'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('tarball violation(s)'));
    expect(io.error).toHaveBeenCalledWith(
      '  - forbidden repository path shipped: package/src/oops.ts',
    );
  });
});
