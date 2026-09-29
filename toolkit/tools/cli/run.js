'use strict';

const { createCommands } = require('../lib/commands');
const io = require('../lib/real-io');

const [name, ...args] = process.argv.slice(2);
const command = createCommands(io)[name];

if (!command) {
  io.error(
    `run: unknown command '${name}'; available: ${Object.keys(createCommands(io)).join(', ')}`,
  );
  io.setExitCode(1);
} else {
  Promise.resolve(command.run(args)).then(
    (code) => io.setExitCode(code),
    (error) => {
      io.error(`run: ${error.message}`);
      io.setExitCode(1);
    },
  );
}
