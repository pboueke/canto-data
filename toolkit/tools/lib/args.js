'use strict';

/** Parse `--name value` pairs and enforce that required flags are present. */
function parseArgs(argv, required) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (typeof flag !== 'string' || !flag.startsWith('--') || typeof value === 'undefined') {
      throw new Error(`expected --name value arguments, got: ${argv.join(' ')}`);
    }
    args[flag.slice(2)] = value;
  }
  for (const name of required) {
    if (typeof args[name] !== 'string' || args[name] === '') {
      throw new Error(`missing --${name}`);
    }
  }
  return args;
}

module.exports = { parseArgs };
