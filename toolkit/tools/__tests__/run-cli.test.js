'use strict';

jest.mock('../lib/commands', () => ({ createCommands: jest.fn() }));
jest.mock('../lib/real-io', () => ({ error: jest.fn(), setExitCode: jest.fn() }));

const { createCommands } = require('../lib/commands');
const io = require('../lib/real-io');

const ORIGINAL_ARGV = process.argv;

async function loadCli(argv) {
  process.argv = ['node', 'run.js', ...argv];
  jest.isolateModules(() => {
    require('../cli/run');
  });
  await new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  process.argv = ORIGINAL_ARGV;
  jest.clearAllMocks();
});

test('runs a known command and records its exit code', async () => {
  const run = jest.fn().mockResolvedValue(0);
  createCommands.mockReturnValue({ audit: { run } });

  await loadCli(['audit', '--json']);

  expect(run).toHaveBeenCalledWith(['--json']);
  expect(io.setExitCode).toHaveBeenCalledWith(0);
});

test('turns a rejected command into a non-zero exit code', async () => {
  const run = jest.fn().mockRejectedValue(new Error('boom'));
  createCommands.mockReturnValue({ audit: { run } });

  await loadCli(['audit']);

  expect(io.error).toHaveBeenCalledWith('run: boom');
  expect(io.setExitCode).toHaveBeenCalledWith(1);
});

test('rejects an unknown command', async () => {
  createCommands.mockReturnValue({ audit: { run: jest.fn() } });

  await loadCli(['explode']);

  expect(io.error).toHaveBeenCalledWith("run: unknown command 'explode'; available: audit");
  expect(io.setExitCode).toHaveBeenCalledWith(1);
});
