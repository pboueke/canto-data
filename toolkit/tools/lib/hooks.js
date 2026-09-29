'use strict';

const path = require('node:path');
const { parseArgs } = require('./args');
const { createBadges } = require('./badges');
const { createVersionCheck } = require('./version');

const METADATA_FILES = ['package.json', 'package-lock.json', 'README.md', 'CHANGELOG.md'];
const FORMATTABLE = /\.(ts|js|mjs|cjs|json|md|yml|yaml)$/;

/**
 * Local hook behavior. Hooks are convenience controls, not a security
 * boundary: they are read-only over the index, never stage anything, and CI
 * from a fresh checkout remains the bypass-resistant backstop.
 */
function createHooks(io) {
  function git(root, args) {
    return io.run('git', ['-C', root, ...args]);
  }

  function stagedFiles(root) {
    const result = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    if (result.status !== 0) {
      throw new Error(`could not list staged files: ${(result.stderr || result.stdout).trim()}`);
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
  }

  /** Metadata staged in the index but further changed in the worktree is ambiguous. */
  function partialStaging(root, files) {
    const problems = [];
    for (const file of files) {
      if (!METADATA_FILES.includes(file)) continue;
      const diff = git(root, ['diff', '--quiet', '--', file]);
      if (diff.status === 1) {
        problems.push(file);
      } else if (diff.status !== 0) {
        throw new Error(`could not compare staged and working-tree ${file}`);
      }
    }
    return problems;
  }

  /** Format-check the staged content itself, not the worktree. */
  function formattingProblems(root, files, nodeModules) {
    const prettier = path.join(nodeModules, 'prettier', 'bin', 'prettier.cjs');
    const problems = [];
    for (const file of files) {
      if (!FORMATTABLE.test(file)) continue;
      const staged = git(root, ['show', `:${file}`]);
      if (staged.status !== 0) {
        problems.push(`${file}: could not read the staged content`);
        continue;
      }
      const result = io.run('node', [prettier, '--check', '--stdin-filepath', file], {
        cwd: root,
        input: staged.stdout,
      });
      if (result.status !== 0) {
        problems.push(`${file}: ${(result.stderr || result.stdout).trim() || 'not formatted'}`);
      }
    }
    return problems;
  }

  function runPreCommit(argv) {
    let args;
    try {
      args = parseArgs(argv, ['root']);
    } catch (error) {
      io.error(`pre-commit: ${error.message}`);
      return 1;
    }
    const root = args.root;
    const nodeModules = args['node-modules'] ?? root;

    try {
      const files = stagedFiles(root);
      if (files.length === 0) {
        io.log('pre-commit: nothing staged');
        return 0;
      }

      const partial = partialStaging(root, files);
      if (partial.length > 0) {
        io.error(`pre-commit: partially staged metadata: ${partial.join(', ')}`);
        io.error(
          'pre-commit: stage the full file or unstage it; the index is never rewritten for you',
        );
        return 1;
      }

      const formatting = formattingProblems(root, files, nodeModules);
      if (formatting.length > 0) {
        io.error(`pre-commit: ${formatting.length} staged file(s) need formatting`);
        for (const problem of formatting) io.error(`  - ${problem}`);
        io.error('pre-commit: run make fmt, then stage the formatted files');
        return 1;
      }

      if (files.some((file) => METADATA_FILES.includes(file))) {
        const violations = [
          ...createVersionCheck(io).validate({ root, base: 'HEAD' }),
          ...createBadges(io).validateBadges({ root }),
        ];
        if (violations.length > 0) {
          io.error('pre-commit: metadata is out of sync');
          for (const violation of violations) io.error(`  - ${violation}`);
          return 1;
        }
      }

      io.log(`pre-commit: ${files.length} staged file(s) pass the fast checks`);
      return 0;
    } catch (error) {
      io.error(`pre-commit: ${error.message}`);
      return 1;
    }
  }

  function install(argv) {
    let args;
    try {
      args = parseArgs(argv, ['root']);
    } catch (error) {
      io.error(`hooks-install: ${error.message}`);
      return 1;
    }
    const root = args.root;
    const force = args.force === 'true';

    try {
      const current = git(root, ['config', '--local', '--get', 'core.hooksPath']);
      if (current.status !== 0 && current.status !== 1) {
        throw new Error(
          `could not read core.hooksPath: ${(current.stderr || current.stdout).trim()}`,
        );
      }
      const configured = current.status === 0 ? current.stdout.trim() : '';

      if (configured === '.githooks') {
        io.log('hooks-install: .githooks is already configured (idempotent)');
        return 0;
      }
      if (configured !== '' && !force) {
        io.error(`hooks-install: core.hooksPath is already set to '${configured}'`);
        io.error(
          'hooks-install: refusing to replace a different hook authority; retire it first, then re-run with --force true',
        );
        return 1;
      }

      const set = git(root, ['config', '--local', 'core.hooksPath', '.githooks']);
      if (set.status !== 0) {
        throw new Error(`could not set core.hooksPath: ${(set.stderr || set.stdout).trim()}`);
      }
      const replaced = configured === '' ? '' : ` (replaced '${configured}')`;
      io.log(`hooks-install: repository-local core.hooksPath set to .githooks${replaced}`);
      return 0;
    } catch (error) {
      io.error(`hooks-install: ${error.message}`);
      return 1;
    }
  }

  return { install, runPreCommit, stagedFiles, partialStaging, formattingProblems };
}

module.exports = { createHooks, METADATA_FILES };
