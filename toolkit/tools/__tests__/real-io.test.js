'use strict';

const path = require('node:path');
const io = require('../lib/real-io');

describe('real-io', () => {
  test('reads files as utf8 text', () => {
    const text = io.readFileSync(path.join(__dirname, 'real-io.test.js'));
    expect(text).toContain('reads files as utf8 text');
  });

  test('reports file existence', () => {
    expect(io.existsSync(__filename)).toBe(true);
    expect(io.existsSync(path.join(__dirname, 'no-such-file'))).toBe(false);
  });

  test('writes files', () => {
    const target = path.join(__dirname, 'real-io-write-probe.tmp');
    try {
      io.writeFileSync(target, 'probe');
      expect(io.readFileSync(target)).toBe('probe');
    } finally {
      require('node:fs').rmSync(target, { force: true });
    }
  });

  test('exposes a fresh clock', () => {
    expect(io.now()).toBeInstanceOf(Date);
  });

  test('logs, reports errors and sets the process exit code', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      io.log('hello');
      io.error('problem');
      io.setExitCode(0);
      expect(logSpy).toHaveBeenCalledWith('hello');
      expect(errorSpy).toHaveBeenCalledWith('problem');
      expect(process.exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test('manages directories and loads modules', () => {
    const os = require('node:os');
    const root = io.mkdtempSync(path.join(os.tmpdir(), 'canto-data-real-io-'));
    try {
      io.mkdirSync(path.join(root, 'nested', 'deep'));
      expect(io.existsSync(path.join(root, 'nested', 'deep'))).toBe(true);
      expect(io.readdirSync(root)).toEqual(expect.arrayContaining(['nested']));
      expect(io.loadModule(__filename)).toBeDefined();
      io.rmSync(root);
      expect(io.existsSync(root)).toBe(false);
    } finally {
      io.rmSync(root);
    }
  });

  test('forwards synchronous execution helpers', () => {
    expect(typeof io.run).toBe('function');
    expect(typeof io.runOrThrow).toBe('function');
  });
});
