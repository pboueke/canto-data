'use strict';

const fs = require('node:fs');
const exec = require('./exec');

/**
 * The one place where tooling helpers touch the outside world. Library helpers
 * receive this object (or a fake of it) so their logic stays fully testable.
 */
module.exports = {
  run: exec.run,
  runOrThrow: exec.runOrThrow,
  readFileSync: (file) => fs.readFileSync(file, 'utf8'),
  writeFileSync: (file, contents) => fs.writeFileSync(file, contents),
  readdirSync: (dir) => fs.readdirSync(dir, { recursive: true }),
  existsSync: (file) => fs.existsSync(file),
  mkdirSync: (dir) => fs.mkdirSync(dir, { recursive: true }),
  mkdtempSync: (prefix) => fs.mkdtempSync(prefix),
  rmSync: (target) => fs.rmSync(target, { recursive: true, force: true }),
  loadModule: (file) => require(file),
  now: () => new Date(),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};
