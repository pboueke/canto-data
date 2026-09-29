'use strict';

const path = require('node:path');
const assert = require('node:assert/strict');

const TYPESCRIPT_VERSION = '5.9.3';
const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const CJS_CHECK = `'use strict';
const assert = require('node:assert/strict');
const root = require('canto-data');
const types = require('canto-data/types');
const format = require('canto-data/format');
const version = require('canto-data/version');
const validation = require('canto-data/validation');
const migration = require('canto-data/migration');

assert.equal(typeof root.validateJournalContent, 'function');
assert.equal(typeof types.pageToPreview, 'function');
assert.equal(typeof format.parseManifest, 'function');
assert.equal(typeof version.compareVersions, 'function');
assert.equal(typeof validation.isPage, 'function');
assert.equal(typeof migration.migrateIfNeeded, 'function');
assert.equal(version.SCHEMA_VERSION, '0.19.0');

const page = {
  id: 'p1',
  text: 'line one\\nline two',
  date: '2026-01-01T00:00:00.000Z',
  tags: ['tag'],
  images: [{ id: 'i1', path: '/files/p.jpg', name: 'p.jpg', type: 'image', encrypted: false, deleted: false }],
  files: [],
  comments: [],
  modified: 1,
  deleted: false,
};
assert.equal(root.validatePage(page), page);
assert.equal(validation.isPage(page), true);
assert.throws(
  () => root.validatePage({}),
  (error) => error.name === 'ValidationError' && error.field === 'page.id',
);
const migrated = root.migrateIfNeeded({ settings: { showMarkdownPlaceholder: true } }, '0.16.0');
assert.equal(migrated.migrated, true);
assert.equal('showMarkdownPlaceholder' in migrated.data.settings, false);
const manifest = root.parseManifest(
  JSON.stringify({ version: 1, appVersion: '1.0.0', exportDate: '2026-01-01T00:00:00.000Z', encrypted: false, journalTitle: 'T' }),
);
assert.equal(manifest.schemaVersion, '0.16.0');
const entries = format.collectAttachmentEntries([page]);
assert.deepEqual(entries, [
  { zipFilename: 'image-i1.jpg', diskPath: '/files/p.jpg', isPasswordEncrypted: false },
]);
const serialized = root.serializePages([page]);
assert.deepEqual(root.deserializePages(serialized), [page]);
assert.equal(root.pageToPreview(page).previewText, 'line one');
console.log('consumer cjs: root and all runtime subpaths behave as documented');
`;

const ESM_CHECK = `import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  deserializePages,
  migrateIfNeeded,
  pageToPreview,
  parseManifest,
  serializePages,
  validatePage,
} from 'canto-data';
import { pageToPreview as subpathPreview } from 'canto-data/types';
import { parseManifest as subpathParseManifest } from 'canto-data/format';
import { compareVersions } from 'canto-data/version';
import { isPage } from 'canto-data/validation';
import { migrateIfNeeded as subpathMigrate } from 'canto-data/migration';

assert.equal(SCHEMA_VERSION, '0.19.0');
assert.equal(compareVersions('0.16.0', SCHEMA_VERSION), -1);
assert.equal(typeof subpathPreview, 'function');
assert.equal(typeof subpathParseManifest, 'function');
assert.equal(typeof subpathMigrate, 'function');

const page = {
  id: 'p1',
  text: 'hello',
  date: '2026-01-01T00:00:00.000Z',
  tags: [],
  images: [],
  files: [],
  comments: [],
  modified: 1,
  deleted: false,
};
assert.equal(isPage(page), true);
assert.equal(validatePage(page), page);
assert.equal(pageToPreview(page).previewText, 'hello');
assert.deepEqual(deserializePages(serializePages([page])), [page]);
assert.equal(migrateIfNeeded({}, '0.19.0').migrated, false);
assert.equal(
  parseManifest(
    JSON.stringify({ version: 1, appVersion: '1', exportDate: 'd', encrypted: false, journalTitle: 't' }),
  ).schemaVersion,
  '0.16.0',
);
console.log('consumer esm: named imports from the CommonJS distribution work');
`;

const TYPES_ROOT_ONLY = `import { DEFAULT_JOURNAL_SETTINGS, SCHEMA_VERSION, validateJournalContent, type JournalContent } from 'canto-data';

const content = {} as JournalContent;
export const values = [SCHEMA_VERSION, DEFAULT_JOURNAL_SETTINGS.sort, typeof validateJournalContent, content];
`;

const TYPES_SUBPATHS = `import type {
  Attachment,
  Journal,
  JournalContent,
  JournalSettings,
  Page,
  PagePreview,
} from 'canto-data/types';
import { DEFAULT_JOURNAL_SETTINGS, pageToPreview } from 'canto-data/types';
import { buildExportManifest, parseManifest } from 'canto-data/format';
import { SCHEMA_VERSION, compareVersions, isFutureVersion, isMajorUpgrade, needsMigration } from 'canto-data/version';
import { ValidationError, isPage, validatePage } from 'canto-data/validation';
import { migrateIfNeeded } from 'canto-data/migration';
import { parseManifest as rootParseManifest, type ExportManifest } from 'canto-data';

const attachment: Attachment = {
  id: 'a',
  path: '/files/p.jpg',
  name: 'p.jpg',
  type: 'image',
  encrypted: false,
  deleted: false,
};
const page: Page = {
  id: 'p',
  text: 'x',
  date: 'd',
  tags: [],
  images: [attachment],
  files: [],
  comments: [],
  modified: 1,
  deleted: false,
};
const settings: JournalSettings = { ...DEFAULT_JOURNAL_SETTINGS };
const journal: Journal = { id: 'j', title: 't', icon: 'i', date: 'd', secure: false, salt: 's' };
const content: JournalContent = { ...journal, pages: [page], settings, version: 1 };

const preview: PagePreview = pageToPreview(page);
const manifest: ExportManifest = parseManifest(
  JSON.stringify({ version: 1, appVersion: '1', exportDate: 'd', encrypted: false, journalTitle: 't' }),
);
const built: ExportManifest = buildExportManifest({ appVersion: '1', encrypted: false, journalTitle: 't' });

export const values = [
  preview,
  manifest,
  built,
  rootParseManifest,
  migrateIfNeeded(content, '0.16.0'),
  validatePage(page),
  isPage(page),
  compareVersions('0.16.0', SCHEMA_VERSION),
  needsMigration('0.16.0'),
  isFutureVersion('0.20.0'),
  isMajorUpgrade('0.16.0', '1.0.0'),
  new ValidationError('field', 'expected', 'received'),
];
`;

const TYPES_NEGATIVE = `import { SCHEMA_VERSION } from 'canto-data';
import type { Journal } from 'canto-data/types';

const wrong: number = SCHEMA_VERSION;
const incomplete: Journal = { id: 'j' };

export const values = [wrong, incomplete];
`;

const { parseArgs } = require('./args');

/** Install the packed tarball into a disposable consumer with pinned TypeScript. */
function installPackage(io, dir, tarball, name) {
  io.mkdirSync(dir);
  io.writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name,
        private: true,
        version: '1.0.0',
        devDependencies: { typescript: TYPESCRIPT_VERSION },
      },
      null,
      2,
    )}\n`,
  );
  const result = io.run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball],
    {
      cwd: dir,
    },
  );
  if (result.status !== 0) {
    throw new Error(`npm install failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

function writeChecks(io, work) {
  const checks = path.join(work, 'checks');
  const types = path.join(checks, 'types');
  io.mkdirSync(types);
  io.writeFileSync(path.join(checks, 'cjs.cjs'), CJS_CHECK);
  io.writeFileSync(path.join(checks, 'esm.mjs'), ESM_CHECK);
  io.writeFileSync(path.join(types, 'root.ts'), TYPES_ROOT_ONLY);
  io.writeFileSync(path.join(types, 'subpaths.ts'), TYPES_SUBPATHS);
  io.writeFileSync(path.join(types, 'invalid.ts'), TYPES_NEGATIVE);
  io.writeFileSync(
    path.join(types, 'tsconfig.node.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020'],
          module: 'commonjs',
          moduleResolution: 'node',
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          skipLibCheck: true,
          types: [],
        },
        files: ['root.ts'],
      },
      null,
      2,
    )}\n`,
  );
  io.writeFileSync(
    path.join(types, 'tsconfig.node16.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020'],
          module: 'node16',
          moduleResolution: 'node16',
          strict: true,
          noEmit: true,
          types: [],
        },
        files: ['subpaths.ts'],
      },
      null,
      2,
    )}\n`,
  );
  io.writeFileSync(
    path.join(types, 'tsconfig.bundler.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020'],
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          types: [],
        },
        files: ['subpaths.ts'],
      },
      null,
      2,
    )}\n`,
  );
  io.writeFileSync(
    path.join(types, 'tsconfig.invalid.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020'],
          module: 'node16',
          moduleResolution: 'node16',
          strict: true,
          noEmit: true,
          types: [],
        },
        files: ['invalid.ts'],
      },
      null,
      2,
    )}\n`,
  );
}

function negativeDiagnostics(io, work) {
  const tsc = path.join(work, 'node_modules', '.bin', 'tsc');
  const result = io.run(tsc, ['-p', path.join(work, 'checks', 'types', 'tsconfig.invalid.json')]);
  if (result.status === 0) {
    return { status: 1, message: 'tsc accepted the deliberately invalid consumer file' };
  }
  const output = `${result.stdout}\n${result.stderr}`;
  const problems = [];
  if (!output.includes('error TS2322')) problems.push('missing expected type error TS2322');
  if (!output.includes('error TS2739')) problems.push('missing expected type error TS2739');
  if (output.includes('error TS2307')) {
    problems.push('saw TS2307 module-resolution failure instead of a type error');
  }
  return problems.length > 0
    ? { status: 1, message: problems.join('; ') }
    : { status: 0, message: '' };
}

/** Exercised by the Node-matrix consumer legs: CJS, ESM, declarations, negatives. */
function createConsumerRun(io) {
  function positiveSteps(work) {
    const tsc = path.join(work, 'node_modules', '.bin', 'tsc');
    const types = path.join(work, 'checks', 'types');
    return [
      [
        'cjs require root and subpaths',
        () => io.run('node', [path.join(work, 'checks', 'cjs.cjs')]),
      ],
      ['esm named imports', () => io.run('node', [path.join(work, 'checks', 'esm.mjs')])],
      [
        'typescript node resolution (root only)',
        () => io.run(tsc, ['-p', path.join(types, 'tsconfig.node.json')]),
      ],
      [
        'typescript node16 resolution (root and subpaths)',
        () => io.run(tsc, ['-p', path.join(types, 'tsconfig.node16.json')]),
      ],
      [
        'typescript bundler resolution (root and subpaths)',
        () => io.run(tsc, ['-p', path.join(types, 'tsconfig.bundler.json')]),
      ],
    ];
  }

  function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['tarball', 'work', 'node-version']);
    } catch (error) {
      io.error(`consumer-run: ${error.message}`);
      return 1;
    }
    const label = `consumer-run(node ${args['node-version']})`;
    try {
      installPackage(io, args.work, args.tarball, `canto-data-consumer-${args['node-version']}`);
      writeChecks(io, args.work);
      for (const [name, step] of positiveSteps(args.work)) {
        const result = step();
        if (result.status !== 0) {
          io.error(`${label}: ${name} failed (exit ${result.status})`);
          io.error((result.stderr || result.stdout).trim());
          return 1;
        }
      }
      const negative = negativeDiagnostics(io, args.work);
      if (negative.status !== 0) {
        io.error(`${label}: negative declarations check failed: ${negative.message}`);
        return 1;
      }
      io.log(`${label}: CJS, ESM, declarations and negative diagnostics pass`);
      return 0;
    } catch (error) {
      io.error(`${label}: ${error.message}`);
      return 1;
    }
  }

  return { run, positiveSteps, negativeDiagnostics, writeChecks };
}

function withFixedClock(ms, fn) {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(ms);
      } else {
        super(...args);
      }
    }
    static now() {
      return ms;
    }
  }
  globalThis.Date = FixedDate;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

/**
 * Installed-tarball lifecycle: legacy migration, validation, attachment
 * mapping, serialization and manifest construction/parsing, with a controlled
 * clock for the time-dependent manifest.
 */
function runLifecycle(api) {
  const failures = [];
  const check = (name, fn) => {
    try {
      fn();
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    }
  };

  const legacy = {
    id: 'journal-int',
    title: 'Integration',
    icon: 'book',
    date: '2025-12-31T00:00:00.000Z',
    secure: false,
    salt: 'c2FsdA==',
    version: 2,
    settings: {
      use24h: false,
      previewTags: true,
      previewThumbnail: true,
      previewIcons: true,
      filterBar: true,
      sort: 'descending',
      autoLocation: false,
      remoteSync: false,
      autoSync: false,
      showMarkdownPlaceholder: true,
    },
    pages: [
      {
        id: 'page-int',
        text: 'hello from the installed package',
        date: '2025-12-31T10:00:00.000Z',
        tags: ['integration'],
        images: [
          {
            id: 'img-int',
            path: '/files/photo.jpg',
            name: 'photo.jpg',
            type: 'image',
            encrypted: false,
            deleted: false,
          },
        ],
        files: [],
        comments: [],
        modified: 1,
        deleted: false,
      },
    ],
  };

  let migrated;
  check('legacy migration', () => {
    migrated = api.migrateIfNeeded(legacy, '0.16.0');
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.fromVersion, '0.16.0');
    assert.equal(migrated.toVersion, api.SCHEMA_VERSION);
    assert.equal('showMarkdownPlaceholder' in migrated.data.settings, false);
    assert.equal(migrated.data.version, 2);
    assert.equal(migrated.data.pages[0].id, 'page-int');
  });

  check('validation of migrated data', () => {
    const validated = api.validateJournalContent(migrated.data);
    assert.equal(validated.pages[0].text, 'hello from the installed package');
    assert.equal(validated.settings.showMarkdownPlaceholder, undefined);
  });

  let entries;
  let rewritten;
  check('attachment collection and path rewriting', () => {
    entries = api.collectAttachmentEntries(migrated.data.pages);
    assert.deepEqual(entries, [
      {
        zipFilename: 'image-img-int.jpg',
        diskPath: '/files/photo.jpg',
        isPasswordEncrypted: false,
      },
    ]);
    const pathMap = new Map(entries.map((entry) => [entry.diskPath, entry.zipFilename]));
    rewritten = api.rewriteAttachmentPaths(migrated.data.pages, pathMap);
    assert.equal(rewritten[0].images[0].path, 'image-img-int.jpg');
    assert.equal(entries[0].diskPath, '/files/photo.jpg');
    assert.equal(migrated.data.pages[0].images[0].path, '/files/photo.jpg');
  });

  check('serialization round trip', () => {
    const serialized = api.serializePages(rewritten);
    assert.deepEqual(api.deserializePages(serialized), rewritten);
  });

  check('manifest construction and parsing with a controlled clock', () => {
    const manifest = withFixedClock(FIXED_NOW, () =>
      api.buildExportManifest({
        appVersion: '9.9.9',
        encrypted: false,
        journalTitle: 'Integration',
        salt: 'c2FsdA==',
        kdfIterations: 100000,
      }),
    );
    assert.equal(manifest.version, 1);
    assert.equal(manifest.schemaVersion, api.SCHEMA_VERSION);
    assert.equal(manifest.appVersion, '9.9.9');
    assert.equal(manifest.exportDate, new Date(FIXED_NOW).toISOString());
    assert.deepEqual(api.parseManifest(JSON.stringify(manifest)), manifest);
  });

  check('validation errors keep their field details', () => {
    assert.throws(
      () => api.validatePage({}),
      (error) => error.name === 'ValidationError' && error.field === 'page.id',
    );
    assert.throws(() => api.migrateIfNeeded({}, '0.20.0'), /Cannot open data with schema version/);
    assert.throws(() => api.migrateIfNeeded({}, '0.15.0'), /No migration path/);
  });

  return failures;
}

function createIntegration(io) {
  function run(argv) {
    let args;
    try {
      args = parseArgs(argv, ['tarball', 'work']);
    } catch (error) {
      io.error(`integration: ${error.message}`);
      return 1;
    }
    try {
      installPackage(io, args.work, args.tarball, 'canto-data-integration');
      const api = io.loadModule(path.join(args.work, 'node_modules', 'canto-data'));
      const failures = runLifecycle(api);
      if (failures.length > 0) {
        io.error(`integration: ${failures.length} lifecycle check(s) failed`);
        for (const failure of failures) io.error(`  - ${failure}`);
        return 1;
      }
      io.log(
        'integration: installed-package migration, validation, attachments, serialization and manifest checks pass',
      );
      return 0;
    } catch (error) {
      io.error(`integration: ${error.message}`);
      return 1;
    }
  }

  return { run, runLifecycle, withFixedClock };
}

module.exports = { createConsumerRun, createIntegration, installPackage, runLifecycle, FIXED_NOW };
