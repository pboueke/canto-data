'use strict';

const { createCommands } = require('../lib/commands');

test('exposes the gate commands as factories over the injected io', () => {
  const commands = createCommands({ marker: true });
  expect(Object.keys(commands).sort()).toEqual([
    'audit',
    'badges-check',
    'badges-sync',
    'browser-prepare',
    'browser-run',
    'consumer-run',
    'contract-check',
    'docs-build',
    'hook-pre-commit',
    'hooks-install',
    'integration',
    'pack-check',
    'version-check',
    'version-sync',
  ]);
  for (const command of Object.values(commands)) {
    expect(typeof command.run).toBe('function');
  }
});

test('every command handles missing arguments without touching the real environment', async () => {
  const io = {
    run: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
    readFileSync: jest.fn(() => '{}'),
    existsSync: jest.fn(() => false),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    loadModule: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  };
  const commands = createCommands(io);
  for (const command of Object.values(commands)) {
    const code = await command.run([]);
    expect(typeof code).toBe('number');
  }
});
