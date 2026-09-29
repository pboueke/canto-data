'use strict';

/**
 * The command registry behind toolkit/tools/cli/run.js.
 *
 * Modules are required lazily so a command only loads what it needs: the
 * Node 18 packaged-consumer leg, for example, must not load the Playwright
 * driver (which requires Node >= 20). Every command is still a factory over
 * the injected io object, so tests never touch the real environment.
 */
function createCommands(io) {
  const lazy = (load, createName, method = 'run') => ({
    run: (...args) => {
      const command = load()[createName](io);
      return command[method](...args);
    },
  });

  return {
    audit: lazy(() => require('./audit'), 'createAudit'),
    'badges-check': lazy(() => require('./badges'), 'createBadges'),
    'badges-sync': lazy(() => require('./badges'), 'createBadges', 'runSync'),
    'browser-prepare': lazy(() => require('./browser'), 'createBrowserPrepare'),
    'browser-run': lazy(() => require('./browser'), 'createBrowserRun'),
    'contract-check': lazy(() => require('./contracts'), 'createContracts'),
    'consumer-run': lazy(() => require('./installed'), 'createConsumerRun'),
    'docs-build': lazy(() => require('./docs'), 'createDocs'),
    'hook-pre-commit': lazy(() => require('./hooks'), 'createHooks', 'runPreCommit'),
    'hooks-install': lazy(() => require('./hooks'), 'createHooks', 'install'),
    integration: lazy(() => require('./installed'), 'createIntegration'),
    'pack-check': lazy(() => require('./pack'), 'createPackCheck'),
    'version-check': lazy(() => require('./version'), 'createVersionCheck'),
    'version-sync': lazy(() => require('./version'), 'createVersionSync'),
  };
}

module.exports = { createCommands };
