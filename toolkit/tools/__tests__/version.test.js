'use strict';

const {
  createVersionCheck,
  createVersionSync,
  collectState,
  parseJson,
  readmeVersionBadge,
} = require('../lib/version');

function changelogText(version, notes = ['chore: work']) {
  return `# Changelog\n\n## v${version} - Release\n\n${notes.map((note) => `- ${note}`).join('\n')}\n`;
}

function filesFor({
  version = '1.0.5',
  lockVersion = version,
  lockRoot = version,
  readme = version,
  notes,
} = {}) {
  return {
    'CHANGELOG.md': changelogText(version, notes),
    'package.json': `${JSON.stringify({ name: 'canto-data', version }, null, 2)}\n`,
    'package-lock.json': `${JSON.stringify({ name: 'canto-data', version: lockVersion, packages: { '': { version: lockRoot } } }, null, 2)}\n`,
    'README.md': `![Version](https://img.shields.io/badge/version-${readme}-green)\n`,
  };
}

function fakeIo(files, baseFiles = null) {
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
    run: jest.fn((_command, args) => {
      const ref = args[args.length - 1];
      if (baseFiles && baseFiles[ref] !== undefined) {
        return { status: 0, stdout: baseFiles[ref], stderr: '' };
      }
      return { status: 128, stdout: '', stderr: 'unknown revision' };
    }),
    existsSync: jest.fn(() => true),
    log: jest.fn(),
    error: jest.fn(),
  };
}

describe('parseJson and readmeVersionBadge', () => {
  test('parses valid JSON and reports invalid JSON', () => {
    expect(parseJson('{"a":1}', 'x')).toEqual({ a: 1 });
    expect(() => parseJson('{oops', 'package.json')).toThrow(/package\.json is not valid JSON/);
  });

  test('extracts the version badge or null', () => {
    expect(readmeVersionBadge('version-1.2.3-green')).toBe('1.2.3');
    expect(readmeVersionBadge('no badge')).toBeNull();
  });
});

describe('collectState', () => {
  test('tolerates lockfiles without packages metadata', () => {
    const files = filesFor();
    files['package-lock.json'] = `${JSON.stringify({ version: '1.0.5' }, null, 2)}\n`;
    expect(collectState(fakeIo(files), '/repo', '').packageLockRoot).toBeNull();

    files['package-lock.json'] = `${JSON.stringify({ version: '1.0.5', packages: {} }, null, 2)}\n`;
    expect(collectState(fakeIo(files), '/repo', '').packageLockRoot).toBeNull();
  });
});

describe('createVersionCheck().validate', () => {
  const root = '/repo';

  test('fails closed when no base is resolved', () => {
    const violations = createVersionCheck(fakeIo(filesFor())).validate({ root, base: '' });
    expect(violations.join('\n')).toMatch(/no version comparison base was resolved/);
  });

  test('reports every disagreeing carrier', () => {
    const io = fakeIo(
      filesFor({ version: '1.0.5', lockVersion: '1.0.0', lockRoot: '1.0.0', readme: '1.0.4' }),
    );
    const violations = createVersionCheck(io).validate({ root, base: 'HEAD' });
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('package-lock.json version'),
        expect.stringContaining('packages[""].version'),
        expect.stringContaining('README.md version badge'),
      ]),
    );
    expect(violations.join('\n')).toMatch(/make version-sync/);
  });

  test('reports a missing README badge as null', () => {
    const files = filesFor();
    files['README.md'] = 'no badge';
    const violations = createVersionCheck(fakeIo(files)).validate({ root, base: 'HEAD' });
    expect(violations).toContain(
      "README.md version badge is missing but CHANGELOG.md declares '1.0.5' — run make version-sync",
    );
  });

  test('fails closed when the working tree cannot be read', () => {
    const io = fakeIo({});
    const violations = createVersionCheck(io).validate({ root, base: 'HEAD' });
    expect(violations.join('\n')).toMatch(/cannot read the working-tree version state/);
  });

  test('fails closed when the base cannot be resolved', () => {
    const violations = createVersionCheck(fakeIo(filesFor())).validate({
      root,
      base: 'origin/main',
    });
    expect(violations.join('\n')).toMatch(/cannot resolve version base 'origin\/main'/);
  });

  test('reports a base read failure from stdout when stderr is empty', () => {
    const io = fakeIo(filesFor());
    io.run = jest.fn(() => ({ status: 128, stdout: 'stdout detail', stderr: '' }));
    const violations = createVersionCheck(io).validate({ root, base: 'origin/main' });
    expect(violations.join('\n')).toContain('stdout detail');
  });

  test('passes when the version is unchanged since the base', () => {
    const files = filesFor({ version: '1.0.5' });
    const base = filesFor({ version: '1.0.5' });
    const io = fakeIo(files, {
      'HEAD:CHANGELOG.md': base['CHANGELOG.md'],
      'HEAD:package.json': base['package.json'],
      'HEAD:package-lock.json': base['package-lock.json'],
      'HEAD:README.md': base['README.md'],
    });
    expect(createVersionCheck(io).validate({ root, base: 'HEAD' })).toEqual([]);
  });

  test('rejects a version that goes backwards', () => {
    const files = filesFor({ version: '1.0.4' });
    const base = filesFor({ version: '1.0.5' });
    const io = fakeIo(files, {
      'HEAD:CHANGELOG.md': base['CHANGELOG.md'],
      'HEAD:package.json': base['package.json'],
      'HEAD:package-lock.json': base['package-lock.json'],
      'HEAD:README.md': base['README.md'],
    });
    expect(createVersionCheck(io).validate({ root, base: 'HEAD' }).join('\n')).toMatch(
      /older than the base version/,
    );
  });

  test('accepts a patch bump for patch notes and a minor bump for feat', () => {
    const base = filesFor({ version: '1.0.4' });
    const baseRefs = {
      'HEAD:CHANGELOG.md': base['CHANGELOG.md'],
      'HEAD:package.json': base['package.json'],
      'HEAD:package-lock.json': base['package-lock.json'],
      'HEAD:README.md': base['README.md'],
    };
    expect(
      createVersionCheck(fakeIo(filesFor({ version: '1.0.5' }), baseRefs)).validate({
        root,
        base: 'HEAD',
      }),
    ).toEqual([]);
    expect(
      createVersionCheck(
        fakeIo(filesFor({ version: '1.1.0', notes: ['feat: thing'] }), baseRefs),
      ).validate({
        root,
        base: 'HEAD',
      }),
    ).toEqual([]);
  });

  test('rejects a bump smaller than the notes require', () => {
    const base = filesFor({ version: '1.0.4' });
    const baseRefs = {
      'HEAD:CHANGELOG.md': base['CHANGELOG.md'],
      'HEAD:package.json': base['package.json'],
      'HEAD:package-lock.json': base['package-lock.json'],
      'HEAD:README.md': base['README.md'],
    };
    const violations = createVersionCheck(
      fakeIo(filesFor({ version: '1.0.5', notes: ['feat: thing'] }), baseRefs),
    ).validate({ root, base: 'HEAD' });
    expect(violations.join('\n')).toMatch(/applies a patch bump but its typed notes require minor/);
  });

  test('rejects malformed notes added since the base', () => {
    const base = filesFor({ version: '1.0.4' });
    const baseRefs = {
      'HEAD:CHANGELOG.md': base['CHANGELOG.md'],
      'HEAD:package.json': base['package.json'],
      'HEAD:package-lock.json': base['package-lock.json'],
      'HEAD:README.md': base['README.md'],
    };
    const violations = createVersionCheck(
      fakeIo(filesFor({ version: '1.0.5', notes: [] }), baseRefs),
    ).validate({ root, base: 'HEAD' });
    expect(violations.join('\n')).toMatch(/no typed notes/);
  });
});

describe('createVersionCheck().run', () => {
  test('rejects bad arguments', () => {
    const io = fakeIo(filesFor());
    expect(createVersionCheck(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('version-check: missing --root');
  });

  test('reports violations and passes clean states', () => {
    const io = fakeIo(filesFor({ lockVersion: '1.0.0' }));
    expect(createVersionCheck(io).run(['--root', '/repo', '--base', 'HEAD'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('version-check:'));
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('package-lock.json version'));

    const clean = fakeIo(filesFor());
    expect(createVersionCheck(clean).run(['--root', '/repo', '--base', 'HEAD'])).toBe(1); // base not resolvable
    expect(clean.error).toHaveBeenCalledWith(
      expect.stringContaining('cannot resolve version base'),
    );

    const withoutBase = fakeIo(filesFor());
    expect(createVersionCheck(withoutBase).run(['--root', '/repo'])).toBe(1);
    expect(withoutBase.error).toHaveBeenCalledWith(
      expect.stringContaining('no version comparison base was resolved'),
    );
  });

  test('passes and logs when every carrier agrees with a readable base', () => {
    const files = filesFor({ version: '1.0.5' });
    const io = fakeIo(files, {
      'HEAD:CHANGELOG.md': files['CHANGELOG.md'],
      'HEAD:package.json': files['package.json'],
      'HEAD:package-lock.json': files['package-lock.json'],
      'HEAD:README.md': files['README.md'],
    });
    expect(createVersionCheck(io).run(['--root', '/repo', '--base', 'HEAD'])).toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      'version-check: CHANGELOG, package.json, lockfile and README agree (base HEAD)',
    );
  });
});

describe('createVersionSync().sync', () => {
  const root = '/repo';

  test('writes every carrier to the changelog version', () => {
    const files = filesFor({
      version: '1.0.5',
      lockVersion: '1.0.0',
      lockRoot: '1.0.0',
      readme: '1.0.4',
    });
    files['package.json'] =
      `${JSON.stringify({ name: 'canto-data', version: '1.0.4' }, null, 2)}\n`;
    const io = fakeIo(files);
    const { target, changed } = createVersionSync(io).sync({ root });
    expect(target).toBe('1.0.5');
    expect(changed).toEqual(['package.json', 'package-lock.json', 'README.md']);
    expect(JSON.parse(files['package.json']).version).toBe('1.0.5');
    const lock = JSON.parse(files['package-lock.json']);
    expect(lock.version).toBe('1.0.5');
    expect(lock.packages[''].version).toBe('1.0.5');
    expect(files['README.md']).toContain('version-1.0.5-green');
  });

  test('is idempotent when everything already agrees', () => {
    const files = filesFor({ version: '1.0.5' });
    const io = fakeIo(files);
    expect(createVersionSync(io).sync({ root })).toEqual({ target: '1.0.5', changed: [] });
    expect(io.writeFileSync).not.toHaveBeenCalled();
  });

  test('handles a lockfile without packages metadata', () => {
    const files = filesFor({ version: '1.0.5', lockVersion: '1.0.0', lockRoot: undefined });
    files['package-lock.json'] =
      `${JSON.stringify({ name: 'canto-data', version: '1.0.0' }, null, 2)}\n`;
    const io = fakeIo(files);
    const { changed } = createVersionSync(io).sync({ root });
    expect(changed).toEqual(['package-lock.json']);
    expect(JSON.parse(files['package-lock.json']).version).toBe('1.0.5');
  });

  test('fails when the README has no version badge', () => {
    const files = filesFor();
    files['README.md'] = 'no badge';
    expect(() => createVersionSync(fakeIo(files)).sync({ root })).toThrow(
      /README\.md has no version badge/,
    );
  });
});

describe('createVersionSync().run', () => {
  test('rejects bad arguments and reports success', () => {
    const io = fakeIo(filesFor());
    expect(createVersionSync(io).run([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('version-sync: missing --root');

    const files = filesFor({ lockVersion: '1.0.0' });
    const syncing = fakeIo(files);
    expect(createVersionSync(syncing).run(['--root', '/repo'])).toBe(0);
    expect(syncing.log).toHaveBeenCalledWith(
      'version-sync: set 1.0.5 in package-lock.json (nothing was staged)',
    );

    const stable = fakeIo(filesFor());
    expect(createVersionSync(stable).run(['--root', '/repo'])).toBe(0);
    expect(stable.log).toHaveBeenCalledWith('version-sync: all carriers already at 1.0.5');
  });

  test('fails visibly on unreadable state', () => {
    const io = fakeIo({});
    expect(createVersionSync(io).run(['--root', '/repo'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('version-sync:'));
  });
});
