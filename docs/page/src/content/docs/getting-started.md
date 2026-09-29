---
title: Getting started
description: Install canto-data and validate your first Canto journal.
---

`canto-data` requires **Node.js 18 or newer** and ships CommonJS with TypeScript
declarations. There are no runtime dependencies. It is the data-layer companion
to the [Canto app](https://pboueke.github.io/canto/) and can be used without it;
see the [relationship notes](/canto-data/relationship/).

## Install

```bash
npm install canto-data
```

## Quick start

```ts
import {
  type JournalContent,
  type Page,
  type Attachment,
  SCHEMA_VERSION,
  DEFAULT_JOURNAL_SETTINGS,
  validateJournalContent,
  ValidationError,
  parseManifest,
  migrateIfNeeded,
} from 'canto-data';
```

## Validate a journal

```ts
import { validateJournalContent, ValidationError } from 'canto-data';

try {
  const journal = validateJournalContent(untrustedData);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Field: ${err.field}`);
    console.error(`Expected: ${err.expected}, got: ${err.received}`);
  }
}
```

Validation is strict and structural: every field is checked and invalid input
throws a `ValidationError` carrying the `field`, the `expected` shape and the
`received` value.

## Read an export manifest

```ts
import { parseManifest } from 'canto-data';

const manifest = parseManifest(manifestJsonString);
console.log(manifest.encrypted);
console.log(manifest.journalTitle);
```

See the [export format](/canto-data/export-format/) for the full archive layout.

## Read legacy data safely

Legacy journals without a `schemaVersion` are treated as `0.16.0`. Use
`migrateIfNeeded` before validating, and `needsMigration` / `isFutureVersion`
to decide what a reader can open:

```ts
import { migrateIfNeeded, isFutureVersion, SCHEMA_VERSION } from 'canto-data';

if (isFutureVersion(journal.schemaVersion)) {
  throw new Error(`This reader supports up to ${SCHEMA_VERSION}`);
}
const { data, migrated, toVersion } = migrateIfNeeded(journal, journal.schemaVersion);
```

The current schema version is re-exported as `SCHEMA_VERSION` so callers do not
hard-code it.

## Import only what you need

Every concern is also available as a subpath export:

```ts
import { isPage } from 'canto-data/validation';
import { parseManifest } from 'canto-data/format';
import { compareVersions } from 'canto-data/version';
```

See the [API reference](/canto-data/api/) for the complete surface.
