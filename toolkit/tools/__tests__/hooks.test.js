'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

jest.mock('../lib/version', () => ({ createVersionCheck: jest.fn() }));
jest.mock('../lib/badges', () => ({ createBadges: jest.fn() }));

const { createHooks, METADATA_FILES } = require('../lib/hooks');
const { createVersionCheck } = require('../lib/version');
const { createBadges } = require('../lib/badges');
const realIo = require('../lib/real-io');

function fakeIo(overrides = {}) {
  return {
    run: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  createVersionCheck.mockReturnValue({ validate: () => [] });
  createBadges.mockReturnValue({ validateBadges: () => [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('stagedFiles', () => {
  test('lists the staged change set', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 0, stdout: 'src/a.ts\nREADME.md\n\n', stderr: '' })),
    });
    expect(createHooks(io).stagedFiles('/repo')).toEqual(['src/a.ts', 'README.md']);
  });

  test('fails when git cannot list staged files', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 128, stdout: '', stderr: 'not a repository' })),
    });
    expect(() => createHooks(io).stagedFiles('/repo')).toThrow(/could not list staged files/);
  });

  test('falls back to stdout when git writes nothing to stderr', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 128, stdout: 'stdout detail', stderr: '' })),
    });
    expect(() => createHooks(io).stagedFiles('/repo')).toThrow(/stdout detail/);
  });
});

describe('partialStaging', () => {
  test('flags metadata that differs between index and worktree', () => {
    const io = fakeIo({
      run: jest.fn((_command, args) => {
        const file = args[args.length - 1];
        return { status: file === 'package.json' ? 1 : 0, stdout: '', stderr: '' };
      }),
    });
    expect(createHooks(io).partialStaging('/repo', [...METADATA_FILES, 'src/a.ts'])).toEqual([
      'package.json',
    ]);
  });

  test('throws when git cannot compare states', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 2, stdout: '', stderr: 'boom' })),
    });
    expect(() => createHooks(io).partialStaging('/repo', ['CHANGELOG.md'])).toThrow(
      /could not compare staged and working-tree CHANGELOG\.md/,
    );
  });
});

describe('formattingProblems', () => {
  const NODE_MODULES = '/repo/node_modules';

  test('skips files prettier does not handle', () => {
    const io = fakeIo();
    expect(createHooks(io).formattingProblems('/repo', ['logo.png'], NODE_MODULES)).toEqual([]);
    expect(io.run).not.toHaveBeenCalled();
  });

  test('fails when the staged content cannot be read', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 128, stdout: '', stderr: 'bad revision' })),
    });
    expect(createHooks(io).formattingProblems('/repo', ['a.ts'], NODE_MODULES)).toEqual([
      'a.ts: could not read the staged content',
    ]);
  });

  test('reports prettier failures with stderr, stdout or a fallback message', () => {
    const withStderr = fakeIo({
      run: jest.fn((command) =>
        command === 'git'
          ? { status: 0, stdout: 'content', stderr: '' }
          : { status: 1, stdout: '', stderr: 'code style issues' },
      ),
    });
    expect(createHooks(withStderr).formattingProblems('/repo', ['a.ts'], NODE_MODULES)).toEqual([
      'a.ts: code style issues',
    ]);

    const withStdout = fakeIo({
      run: jest.fn((command) =>
        command === 'git'
          ? { status: 0, stdout: 'content', stderr: '' }
          : { status: 2, stdout: 'prettier exploded', stderr: '' },
      ),
    });
    expect(createHooks(withStdout).formattingProblems('/repo', ['a.ts'], NODE_MODULES)).toEqual([
      'a.ts: prettier exploded',
    ]);

    const silent = fakeIo({
      run: jest.fn((command) =>
        command === 'git'
          ? { status: 0, stdout: 'content', stderr: '' }
          : { status: 1, stdout: '', stderr: '' },
      ),
    });
    expect(createHooks(silent).formattingProblems('/repo', ['a.ts'], NODE_MODULES)).toEqual([
      'a.ts: not formatted',
    ]);
  });

  test('passes well-formatted staged files', () => {
    const io = fakeIo({
      run: jest.fn((command) =>
        command === 'git'
          ? { status: 0, stdout: 'content', stderr: '' }
          : { status: 0, stdout: 'All matched files use Prettier code style!', stderr: '' },
      ),
    });
    expect(createHooks(io).formattingProblems('/repo', ['a.ts'], NODE_MODULES)).toEqual([]);
  });
});

describe('runPreCommit', () => {
  test('rejects bad arguments', () => {
    const io = fakeIo();
    expect(createHooks(io).runPreCommit([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('pre-commit: missing --root');
  });

  test('passes when nothing is staged', () => {
    const io = fakeIo();
    expect(createHooks(io).runPreCommit(['--root', '/repo'])).toBe(0);
    expect(io.log).toHaveBeenCalledWith('pre-commit: nothing staged');
    expect(createVersionCheck).not.toHaveBeenCalled();
  });

  test('rejects partially staged metadata before anything else', () => {
    const io = fakeIo({
      run: jest.fn((_command, args) => {
        if (args.includes('--name-only'))
          return { status: 0, stdout: 'package.json\n', stderr: '' };
        if (args.includes('--quiet')) return { status: 1, stdout: '', stderr: '' };
        return { status: 0, stdout: '', stderr: '' };
      }),
    });
    expect(createHooks(io).runPreCommit(['--root', '/repo'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('pre-commit: partially staged metadata: package.json');
  });

  test('rejects staged files that need formatting', () => {
    const io = fakeIo({
      run: jest.fn((_command, args) => {
        if (args.includes('--name-only')) return { status: 0, stdout: 'src/a.ts\n', stderr: '' };
        if (args.includes('show')) return { status: 0, stdout: 'const a=1', stderr: '' };
        return { status: 1, stdout: '', stderr: 'code style issues' };
      }),
    });
    expect(
      createHooks(io).runPreCommit(['--root', '/repo', '--node-modules', '/repo/node_modules']),
    ).toBe(1);
    expect(io.error).toHaveBeenCalledWith('pre-commit: 1 staged file(s) need formatting');
    expect(io.error).toHaveBeenCalledWith(
      'pre-commit: run make fmt, then stage the formatted files',
    );
  });

  test('checks metadata synchronization only when metadata is staged', () => {
    createVersionCheck.mockReturnValue({ validate: () => ['version drift'] });
    const io = fakeIo({
      run: jest.fn((_command, args) => {
        if (args.includes('--name-only'))
          return { status: 0, stdout: 'CHANGELOG.md\n', stderr: '' };
        return { status: 0, stdout: '', stderr: '' };
      }),
    });
    expect(createHooks(io).runPreCommit(['--root', '/repo'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('pre-commit: metadata is out of sync');
    expect(io.error).toHaveBeenCalledWith('  - version drift');
    expect(createVersionCheck).toHaveBeenCalledWith(io);
    expect(createBadges).toHaveBeenCalledWith(io);
  });

  test('passes non-metadata changes without touching version or badge checks', () => {
    const io = fakeIo({
      run: jest.fn((_command, args) => {
        if (args.includes('--name-only')) return { status: 0, stdout: 'src/a.ts\n', stderr: '' };
        if (args.includes('show')) return { status: 0, stdout: 'const a = 1;\n', stderr: '' };
        return { status: 0, stdout: '', stderr: '' };
      }),
    });
    expect(
      createHooks(io).runPreCommit(['--root', '/repo', '--node-modules', '/repo/node_modules']),
    ).toBe(0);
    expect(io.log).toHaveBeenCalledWith('pre-commit: 1 staged file(s) pass the fast checks');
    expect(createVersionCheck).not.toHaveBeenCalled();
  });

  test('passes synced metadata', () => {
    const io = fakeIo({
      run: jest.fn((_command, args) => {
        if (args.includes('--name-only'))
          return { status: 0, stdout: 'package.json\n', stderr: '' };
        if (args.includes('show')) return { status: 0, stdout: '{}\n', stderr: '' };
        return { status: 0, stdout: '', stderr: '' };
      }),
    });
    expect(
      createHooks(io).runPreCommit(['--root', '/repo', '--node-modules', '/repo/node_modules']),
    ).toBe(0);
    expect(createVersionCheck).toHaveBeenCalled();
    expect(createBadges).toHaveBeenCalled();
  });

  test('fails visibly when git is unusable', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 128, stdout: '', stderr: 'not a repository' })),
    });
    expect(createHooks(io).runPreCommit(['--root', '/repo'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      expect.stringContaining('pre-commit: could not list staged files'),
    );
  });
});

describe('install', () => {
  test('rejects bad arguments', () => {
    const io = fakeIo();
    expect(createHooks(io).install([])).toBe(1);
    expect(io.error).toHaveBeenCalledWith('hooks-install: missing --root');
  });

  test('is idempotent when .githooks is already configured', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 0, stdout: '.githooks\n', stderr: '' })),
    });
    expect(createHooks(io).install(['--root', '/repo'])).toBe(0);
    expect(io.log).toHaveBeenCalledWith(
      'hooks-install: .githooks is already configured (idempotent)',
    );
  });

  test('sets .githooks when nothing is configured', () => {
    const io = fakeIo({
      run: jest.fn((_command, args) =>
        args.includes('--get')
          ? { status: 1, stdout: '', stderr: '' }
          : { status: 0, stdout: '', stderr: '' },
      ),
    });
    expect(createHooks(io).install(['--root', '/repo'])).toBe(0);
    expect(io.run).toHaveBeenLastCalledWith('git', [
      '-C',
      '/repo',
      'config',
      '--local',
      'core.hooksPath',
      '.githooks',
    ]);
  });

  test('refuses to replace another hook authority without owner action', () => {
    const io = fakeIo({
      run: jest.fn(() => ({ status: 0, stdout: '.husky/_\n', stderr: '' })),
    });
    expect(createHooks(io).install(['--root', '/repo'])).toBe(1);
    expect(io.error).toHaveBeenCalledWith(
      "hooks-install: core.hooksPath is already set to '.husky/_'",
    );

    const forced = fakeIo({
      run: jest.fn((_command, args) =>
        args.includes('--get')
          ? { status: 0, stdout: '.husky/_\n', stderr: '' }
          : { status: 0, stdout: '', stderr: '' },
      ),
    });
    expect(createHooks(forced).install(['--root', '/repo', '--force', 'true'])).toBe(0);
    expect(forced.log).toHaveBeenCalledWith(
      "hooks-install: repository-local core.hooksPath set to .githooks (replaced '.husky/_')",
    );
  });

  test('fails when git config cannot be read or written', () => {
    const unreadable = fakeIo({
      run: jest.fn(() => ({ status: 2, stdout: '', stderr: 'git broke' })),
    });
    expect(createHooks(unreadable).install(['--root', '/repo'])).toBe(1);
    expect(unreadable.error).toHaveBeenCalledWith(
      expect.stringContaining('could not read core.hooksPath'),
    );

    const unreadableStdout = fakeIo({
      run: jest.fn(() => ({ status: 2, stdout: 'stdout detail', stderr: '' })),
    });
    expect(createHooks(unreadableStdout).install(['--root', '/repo'])).toBe(1);
    expect(unreadableStdout.error).toHaveBeenCalledWith(expect.stringContaining('stdout detail'));

    const unwritable = fakeIo({
      run: jest.fn((_command, args) =>
        args.includes('--get')
          ? { status: 1, stdout: '', stderr: '' }
          : { status: 1, stdout: '', stderr: 'read-only config' },
      ),
    });
    expect(createHooks(unwritable).install(['--root', '/repo'])).toBe(1);
    expect(unwritable.error).toHaveBeenCalledWith(
      expect.stringContaining('could not set core.hooksPath'),
    );

    const unwritableStdout = fakeIo({
      run: jest.fn((_command, args) =>
        args.includes('--get')
          ? { status: 1, stdout: '', stderr: '' }
          : { status: 1, stdout: 'stdout detail', stderr: '' },
      ),
    });
    expect(createHooks(unwritableStdout).install(['--root', '/repo'])).toBe(1);
    expect(unwritableStdout.error).toHaveBeenCalledWith(expect.stringContaining('stdout detail'));
  });
});

describe('hook behavior with real git', () => {
  const REPO_NODE_MODULES = path.join(__dirname, '..', '..', '..', 'node_modules');

  function git(dir, args) {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  }

  function tempRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canto-data-hooks-real-'));
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'hooks@example.com']);
    git(dir, ['config', 'user.name', 'Hook Test']);
    return dir;
  }

  function cleanup(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  test('passes an empty index and fails on unformatted staged content, then passes once formatted', () => {
    const dir = tempRepo();
    try {
      const hooks = createHooks(realIo);
      expect(hooks.runPreCommit(['--root', dir, '--node-modules', REPO_NODE_MODULES])).toBe(0);

      const notes = path.join(dir, 'notes.md');
      fs.writeFileSync(notes, '#  Notes   \n\n');
      git(dir, ['add', 'notes.md']);
      expect(hooks.runPreCommit(['--root', dir, '--node-modules', REPO_NODE_MODULES])).toBe(1);

      execFileSync(
        'node',
        [path.join(REPO_NODE_MODULES, 'prettier', 'bin', 'prettier.cjs'), '--write', 'notes.md'],
        {
          cwd: dir,
        },
      );
      git(dir, ['add', 'notes.md']);
      expect(hooks.runPreCommit(['--root', dir, '--node-modules', REPO_NODE_MODULES])).toBe(0);
    } finally {
      cleanup(dir);
    }
  });

  test('rejects partially staged metadata in a real repository', () => {
    const dir = tempRepo();
    try {
      const manifest = path.join(dir, 'package.json');
      fs.writeFileSync(manifest, '{\n  "name": "temp",\n  "version": "1.0.0"\n}\n');
      git(dir, ['add', 'package.json']);
      fs.writeFileSync(manifest, '{\n  "name": "temp",\n  "version": "1.0.1"\n}\n');
      expect(
        createHooks(realIo).runPreCommit(['--root', dir, '--node-modules', REPO_NODE_MODULES]),
      ).toBe(1);
    } finally {
      cleanup(dir);
    }
  });

  test('installs and guards a real repository-local hook path', () => {
    const dir = tempRepo();
    try {
      const hooks = createHooks(realIo);
      expect(hooks.install(['--root', dir])).toBe(0);
      expect(git(dir, ['config', '--local', '--get', 'core.hooksPath']).trim()).toBe('.githooks');
      expect(hooks.install(['--root', dir])).toBe(0);
      git(dir, ['config', '--local', 'core.hooksPath', '.husky/_']);
      expect(hooks.install(['--root', dir])).toBe(1);
      expect(hooks.install(['--root', dir, '--force', 'true'])).toBe(0);
      expect(git(dir, ['config', '--local', '--get', 'core.hooksPath']).trim()).toBe('.githooks');
    } finally {
      cleanup(dir);
    }
  });

  test('the shell hooks locate the repository root and propagate make failures', () => {
    const dir = tempRepo();
    try {
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      const record = path.join(dir, 'make-args.txt');
      const make = path.join(bin, 'make');
      fs.writeFileSync(
        make,
        `#!/usr/bin/env bash\nprintf '%s\\n' "$*" > "${record}"\nexit "${'${MAKE_EXIT:-0}'}"\n`,
        { mode: 0o755 },
      );
      const repoRoot = path.join(__dirname, '..', '..', '..');
      const runHook = (script, makeExit) =>
        spawnSync('bash', [path.join(repoRoot, '.githooks', script)], {
          cwd: dir,
          encoding: 'utf8',
          env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAKE_EXIT: String(makeExit) },
        });

      const preCommit = runHook('pre-commit', 0);
      expect(preCommit.status).toBe(0);
      expect(fs.readFileSync(record, 'utf8').trim()).toBe('--no-print-directory hook-pre-commit');

      const prePush = runHook('pre-push', 7);
      expect(prePush.status).toBe(7);
      expect(fs.readFileSync(record, 'utf8').trim()).toBe('--no-print-directory verify');
      expect(prePush.stderr).toContain('pre-push: running the full gate');
    } finally {
      cleanup(dir);
    }
  });
});
