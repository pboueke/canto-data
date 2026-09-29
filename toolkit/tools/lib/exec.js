'use strict';

const { spawnSync } = require('node:child_process');

/**
 * Run a command synchronously and capture its output. A non-zero exit status is
 * returned to the caller; only a process that could not be started at all
 * throws. Callers that want failure-as-exception use runOrThrow.
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    // stdin is piped when the caller supplies input (e.g. prettier --stdin-filepath).
    stdio: options.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error) {
    throw new Error(`could not run '${command}': ${result.error.message}`);
  }

  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** Run a command and throw when it exits non-zero, including its output. */
function runOrThrow(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new Error(
      `command failed: ${command} ${args.join(' ')} (exit ${result.status})${detail ? `\n${detail}` : ''}`,
    );
  }
  return result;
}

module.exports = { run, runOrThrow };
