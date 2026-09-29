'use strict';

const { run, runOrThrow } = require('../lib/exec');

describe('exec.run', () => {
  test('captures stdout, stderr and a zero status', () => {
    const result = run(process.execPath, [
      '-e',
      'process.stdout.write("out"); process.stderr.write("err");',
    ]);
    expect(result).toEqual({ status: 0, stdout: 'out', stderr: 'err' });
  });

  test('returns a non-zero status instead of throwing', () => {
    const result = run(process.execPath, ['-e', 'process.exit(3)']);
    expect(result.status).toBe(3);
  });

  test('turns a missing executable into an actionable error', () => {
    expect(() => run('canto-data-missing-command', [])).toThrow(
      /could not run 'canto-data-missing-command'/,
    );
  });

  test('normalizes a signal termination to exit status 1', () => {
    const result = run(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"]);
    expect(result.status).toBe(1);
  });

  test('forwards stdin input when supplied', () => {
    const result = run(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], {
      input: 'piped content',
    });
    expect(result).toEqual({ status: 0, stdout: 'piped content', stderr: '' });
  });

  test('tolerates ignored output streams', () => {
    const result = run(process.execPath, ['-e', ''], { stdio: 'ignore' });
    expect(result).toEqual({ status: 0, stdout: '', stderr: '' });
  });
});

describe('exec.runOrThrow', () => {
  test('returns output on success', () => {
    const result = runOrThrow(process.execPath, ['-e', 'process.stdout.write("ok")']);
    expect(result.stdout).toBe('ok');
  });

  test('throws with the exit status and stderr', () => {
    expect(() =>
      runOrThrow(process.execPath, ['-e', 'process.stderr.write("boom"); process.exit(2)']),
    ).toThrow(/exit 2\)\nboom/);
  });

  test('falls back to stdout when stderr is empty', () => {
    expect(() =>
      runOrThrow(process.execPath, ['-e', 'process.stdout.write("only"); process.exit(4)']),
    ).toThrow(/exit 4\)\nonly/);
  });

  test('throws without a detail block when the command printed nothing', () => {
    expect(() => runOrThrow(process.execPath, ['-e', 'process.exit(5)'])).toThrow(/exit 5\)$/);
  });
});
