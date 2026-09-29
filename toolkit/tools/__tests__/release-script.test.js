'use strict';

/**
 * Behavioral tests for the owner-run release script. Every external command
 * (git, make, podman) is stubbed on PATH so the script can be exercised end to
 * end without a registry, a container runtime or a publish.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'release.sh');
const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const HASH = '9'.repeat(64);
const OTHER_HASH = '8'.repeat(64);

function writeStub(dir, name, body) {
  fs.writeFileSync(path.join(dir, name), body, { mode: 0o755 });
}

function fixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canto-release-'));
  try {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(dir, '.cache', 'canto-data', 'pack'), { recursive: true });
    fs.copyFileSync(SCRIPT, path.join(dir, 'release.sh'));
    fs.chmodSync(path.join(dir, 'release.sh'), 0o755);
    const calls = path.join(dir, 'calls');
    fs.writeFileSync(calls, '');

    writeStub(
      bin,
      'git',
      `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> "$RELEASE_CALLS"
case "$1 $2" in
  'status --porcelain')
    [[ "\${RELEASE_DIRTY:-}" == true ]] && printf ' M tracked.md\\n'
    ;;
  'rev-parse HEAD') printf '%s\\n' '${HEAD}' ;;
  'ls-remote --exit-code')
    case "\${RELEASE_TAG:-present}" in
      missing) exit 2 ;;
      other) printf '%s\\trefs/tags/v0.1.0\\n' '${OTHER}' ;;
      annotated)
        printf '%s\\trefs/tags/v0.1.0\\n' '${OTHER}'
        printf '%s\\trefs/tags/v0.1.0^{}\\n' '${HEAD}'
        ;;
      *) printf '%s\\trefs/tags/v0.1.0\\n' '${HEAD}' ;;
    esac
    ;;
  'fetch --no-tags') ;;
  'merge-base --is-ancestor')
    [[ "\${RELEASE_ON_MAIN:-true}" == true ]] || exit 1
    ;;
  *) exit 98 ;;
esac
`,
    );

    writeStub(
      bin,
      'make',
      `#!/usr/bin/env bash
printf 'make %s\\n' "$*" >> "$RELEASE_CALLS"
if [[ "$*" == 'pack' && "\${RELEASE_NO_PACK:-}" != true ]]; then
  printf 'candidate-bytes' > .cache/canto-data/pack/canto-data-0.1.0.tgz
fi
`,
    );

    writeStub(
      bin,
      'podman',
      `#!/usr/bin/env bash
printf 'podman %s\\n' "$*" >> "$RELEASE_CALLS"
case "$*" in
  *'node -e '*)
    [[ "\${RELEASE_MANIFEST:-}" == invalid ]] && exit 1
    printf '%s\\n' '0.1.0'
    ;;
  *'npm view canto-data@0.1.0 version'*)
    if [[ "\${RELEASE_DUPLICATE:-}" == true ]]; then printf '%s\\n' '0.1.0'; else exit 1; fi
    ;;
  *'npm view canto-data version'*)
    [[ "\${RELEASE_LATEST:-0.0.9}" == error ]] && exit 1
    printf '%s\\n' "\${RELEASE_LATEST:-0.0.9}"
    ;;
  *'bash -lc'*)
    printf '%s  /tmp/canto-data-0.1.0.tgz\\n' "\${RELEASE_REPACK_HASH:-${HASH}}"
    ;;
  *'sha256sum '*)
    case "\${*: -1}" in
      .release/*) printf '%s  %s\\n' "\${RELEASE_STAGED_HASH:-${HASH}}" "\${*: -1}" ;;
      *) printf '%s  %s\\n' '${HASH}' "\${*: -1}" ;;
    esac
    ;;
  *'npm login'* | *'npm whoami'* | *'npm publish'*) ;;
  *) exit 98 ;;
esac
`,
    );

    run(dir, bin, calls);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function execute(dir, bin, calls, mode, env = {}) {
  const result = spawnSync('bash', [path.join(dir, 'release.sh'), mode], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      RELEASE_CALLS: calls,
      ...env,
    },
  });
  return { status: result.status, stdout: String(result.stdout), stderr: String(result.stderr) };
}

function callsOf(calls) {
  return fs.readFileSync(calls, 'utf8');
}

describe('release.sh', () => {
  test('is valid bash, defaults to check mode and never tags or pushes', () => {
    const checked = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    expect(checked.status).toBe(0);
    const text = fs.readFileSync(SCRIPT, 'utf8');
    expect(text).toMatch(/mode="\$\{1:---check\}"/);
    // The owner creates and pushes tags; the script must never execute them.
    expect(text).not.toMatch(/^\s*git (tag|push)\b/m);
    expect(text).toMatch(/git tag \$tag && git push origin \$tag/);
    expect(text).toMatch(/read -r confirmation/);
    expect(text).toMatch(/npm_toolkit publish "\.\/\$artifact" --ignore-scripts/);
  });

  test('check mode verifies the tag, gate, checksums and fresh pack without publishing', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('check-only; nothing was published');
      const recorded = callsOf(calls);
      expect(recorded).toMatch(/git ls-remote --exit-code origin refs\/tags\/v0\.1\.0/);
      expect(recorded).toMatch(/make verify VERSION_BASE=origin\/main/);
      expect(recorded).toMatch(/make pack/);
      expect(recorded).toMatch(/npm pack --ignore-scripts --pack-destination \/tmp/);
      expect(recorded).not.toContain('npm publish');
      expect(recorded).not.toContain('npm login');
      expect(fs.readFileSync(path.join(dir, '.release/canto-data-0.1.0.tgz'), 'utf8')).toBe(
        'candidate-bytes',
      );
      expect(fs.readFileSync(path.join(dir, '.release/SHA256SUMS'), 'utf8')).toBe(
        `${HASH}  .release/canto-data-0.1.0.tgz\n`,
      );
    });
  });

  test('an annotated remote tag still identifies the checkout', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_TAG: 'annotated' });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('check-only; nothing was published');
    });
  });

  test('a dirty worktree stops before any tool command', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_DIRTY: 'true' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/commit or remove worktree changes/);
      expect(callsOf(calls)).not.toContain('make');
    });
  });

  test('missing or mismatched remote tags stop before packing or publishing', () => {
    for (const [tagMode, message] of [
      ['missing', /tag is missing/],
      ['other', /does not identify this checkout/],
    ]) {
      fixture((dir, bin, calls) => {
        const result = execute(dir, bin, calls, '--check', { RELEASE_TAG: tagMode });
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(message);
        expect(callsOf(calls)).not.toContain('npm pack');
      });
    }
  });

  test('a checkout that is not on origin/main stops before packing', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_ON_MAIN: 'false' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/is not on origin\/main/);
      expect(callsOf(calls)).not.toContain('npm pack');
    });
  });

  test('an unpublishable manifest stops the release', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_MANIFEST: 'invalid' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/not a publishable canto-data package/);
      expect(callsOf(calls)).not.toContain('make verify');
    });
  });

  test('duplicate versions, a higher registry head and registry errors stop the release', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_DUPLICATE: 'true' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/is already published/);
      expect(callsOf(calls)).not.toContain('make verify');
    });
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_LATEST: '0.2.0' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/not ahead of it/);
      expect(callsOf(calls)).not.toContain('make verify');
    });
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_LATEST: 'error' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/refusing to publish blind/);
    });
  });

  test('a missing packed candidate, a mismatched staged copy and a mismatched repack stop it', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_NO_PACK: 'true' });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/missing \.cache\/canto-data\/pack/);
      expect(callsOf(calls)).not.toContain('npm pack');
    });
    fixture((dir, bin, calls) => {
      fs.mkdirSync(path.join(dir, '.release'));
      fs.writeFileSync(path.join(dir, '.release/canto-data-0.1.0.tgz'), 'other-bytes');
      const result = execute(dir, bin, calls, '--check', { RELEASE_STAGED_HASH: OTHER_HASH });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/remove it deliberately/);
      expect(callsOf(calls)).not.toContain('npm pack');
    });
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--check', { RELEASE_REPACK_HASH: OTHER_HASH });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/differs from a fresh pack/);
      expect(callsOf(calls)).not.toContain('npm publish');
    });
  });

  test('publishing refuses a noninteractive invocation before any tool command', () => {
    fixture((dir, bin, calls) => {
      const result = execute(dir, bin, calls, '--publish');
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/requires an interactive terminal/);
      expect(callsOf(calls)).toBe('');
    });
  });

  test('usage errors and --help are explicit', () => {
    fixture((dir, bin, calls) => {
      expect(execute(dir, bin, calls, '--help').status).toBe(0);
      expect(execute(dir, bin, calls, '--check', {}).status).toBe(0);
      expect(callsOf(calls)).not.toContain('npm publish');
    });
    fixture((dir, _bin, _calls) => {
      const result = spawnSync('bash', [path.join(dir, 'release.sh'), '--check', '--publish'], {
        cwd: dir,
        encoding: 'utf8',
      });
      expect(result.status).toBe(2);
      expect(String(result.stderr)).toMatch(/Usage: \.\/release\.sh/);
    });
    fixture((dir) => {
      const result = spawnSync('bash', [path.join(dir, 'release.sh'), '--wat'], {
        cwd: dir,
        encoding: 'utf8',
      });
      expect(result.status).toBe(2);
      expect(String(result.stderr)).toMatch(/Usage: \.\/release\.sh/);
    });
  });
});
