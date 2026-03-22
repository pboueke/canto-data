# canto-data

Data model library for [Canto](https://github.com/pboueke/canto), a private encrypted journaling app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.0.3-green)
![Tests](https://img.shields.io/badge/tests-156%2F156%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

`canto-data` provides TypeScript types, runtime validation, schema versioning, migration infrastructure, and export format utilities for Canto journals.

This package is **MIT-licensed** and has **zero dependencies**. It can be used independently of the Canto app to read, validate, and manipulate Canto journal data.

## Relationship to the Canto App

Canto (the app) is GPLv3-licensed. `canto-data` (this library) is MIT-licensed to enable data portability: anyone can build tools that interoperate with Canto journals without being bound by the app's copyleft license.

```text
canto-data (MIT)
└── src/
    ├── types.ts              # All TypeScript interfaces
    ├── validation.ts         # Type guards and structural validators
    ├── version.ts            # Schema version constant and semver utils
    ├── migration.ts          # Forward-only migration runner
    ├── migrations/           # Migration registry
    └── format.ts             # Export manifest and ZIP format utilities
```

What `canto-data` owns:

- All journal data types (Journal, Page, Attachment, Comment, and related structures)
- Runtime validation and type guards
- Schema versioning and migration framework
- Export format specification (manifest structure and attachment naming)

What it does **not** include:

- Encryption and decryption
- Storage backends
- Sync integrations
- UI components

Those pieces live in the [Canto app](https://github.com/pboueke/canto).

## Installation

```bash
npm install canto-data
```

## Quick Start

```typescript
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
} from "canto-data";
```

### Validating Journal Data

```typescript
import { validateJournalContent, ValidationError } from "canto-data";

try {
  const journal = validateJournalContent(untrustedData);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Field: ${err.field}`);
    console.error(`Expected: ${err.expected}, got: ${err.received}`);
  }
}
```

### Reading an Export Manifest

```typescript
import { parseManifest } from "canto-data";

const manifest = parseManifest(manifestJsonString);
console.log(manifest.encrypted);
console.log(manifest.journalTitle);
```

### Checking Schema Version and Migrating

```typescript
import { migrateIfNeeded } from "canto-data";

const result = migrateIfNeeded(rawData, manifest.schemaVersion);
if (result.migrated) {
  console.log(`Migrated from ${result.fromVersion} to ${result.toVersion}`);
}
```

### Working with Exported Journals

A `.canto.zip` file contains:

```text
{journal-title}.canto.zip
├── manifest.json
├── journal.json
├── settings.json
├── pages/
│   ├── {pageId}.json
│   └── ...
└── attachments/
    ├── {type}-{id}.{ext}
    └── ...
```

Example: list all entries from an unencrypted export.

```typescript
import JSZip from "jszip";
import { parseManifest } from "canto-data";
import type { Page } from "canto-data";

const zip = await JSZip.loadAsync(zipBuffer);
const manifest = parseManifest(
  await zip.file("manifest.json")!.async("string"),
);

if (manifest.encrypted) {
  console.log("This export is encrypted and requires the journal password.");
} else {
  const pageFiles = zip.file(/^pages\/.*\.json$/);
  for (const pf of pageFiles) {
    const page: Page = JSON.parse(await pf.async("string"));
    console.log(`${page.date}: ${page.text.substring(0, 80)}...`);
  }
}
```

## Data Model

```text
JournalContent
├── id: string (UUID)
├── title: string
├── icon: string (emoji)
├── date: string (ISO 8601, creation date)
├── secure: boolean
├── salt: string (base64, always present)
├── biometric?: boolean
├── kdfIterations?: number (PBKDF2, default 50000)
├── themeOverride?: string
├── schemaVersion?: string (semver)
├── version: number (deprecated, always 1)
├── settings: JournalSettings
│   ├── use24h: boolean
│   ├── previewTags: boolean
│   ├── previewThumbnail: boolean
│   ├── previewIcons: boolean
│   ├── filterBar: boolean
│   ├── sort: 'ascending' | 'descending' | 'none'
│   ├── autoLocation: boolean
│   ├── remoteSync: boolean
│   ├── syncProvider?: 'gdrive'
│   ├── autoSync: boolean
│   └── themeOverride?: string
└── pages: Page[]
    ├── id: string (UUID)
    ├── text: string (Markdown)
    ├── date: string (ISO 8601, entry date)
    ├── modified: number (Unix timestamp ms)
    ├── deleted: boolean
    ├── thumbnail?: string (base64)
    ├── tags: string[]
    ├── location?: GeoLocation
    │   ├── latitude: number
    │   ├── longitude: number
    │   ├── altitude?: number
    │   └── accuracy?: number
    ├── comments: Comment[]
    │   ├── id: string
    │   ├── text: string
    │   └── date: string (ISO 8601)
    ├── images: Attachment[]
    │   ├── id: string (UUID)
    │   ├── path: string
    │   ├── name: string (original filename)
    │   ├── type: 'image'
    │   ├── encrypted: boolean
    │   ├── size?: number (bytes)
    │   └── deleted: boolean
    └── files: Attachment[]
        └── same fields as images, with type: 'file'
```

## Schema Versioning

Canto journal schemas follow [semver](https://semver.org/):

| Change type                            | Version bump | Migration needed? |
| -------------------------------------- | ------------ | ----------------- |
| Breaking (field removed, type changed) | MAJOR        | Yes               |
| New optional field                     | MINOR        | No                |
| Documentation or validation fix        | PATCH        | No                |

The schema version is stored in `JournalContent.schemaVersion` and `ExportManifest.schemaVersion`. Legacy data without `schemaVersion` is treated as `0.16.0`. Migrations are forward-only.

### Migration History

| From   | To     | Description                                         |
| ------ | ------ | --------------------------------------------------- |
| 0.16.0 | 0.17.0 | Remove deprecated `showMarkdownPlaceholder` setting |

## Export Format Details

### `manifest.json`

```json
{
  "version": 1,
  "schemaVersion": "0.17.0",
  "appVersion": "0.17.0",
  "exportDate": "2026-01-01T00:00:00.000Z",
  "encrypted": false,
  "journalTitle": "My Journal",
  "salt": "base64...",
  "kdfIterations": 50000
}
```

- `version`: Manifest format version, always `1`
- `schemaVersion`: Journal schema version; absent in legacy exports and treated as `0.16.0`
- `encrypted`: If `true`, all JSON and attachment content is AES-256-GCM encrypted
- `salt` and `kdfIterations`: Present for password-protected journals

### Encrypted Exports

When `encrypted: true`, decryption requires the journal password. The ciphertext format is `[12-byte nonce][ciphertext][16-byte GCM tag]` using AES-256-GCM. See [Canto SECURITY.md](https://github.com/pboueke/canto/blob/main/SECURITY.md) for the full encryption model.

### Import Behavior

Importing always creates a new journal with new UUIDs, so re-importing the same archive is safe. Shared attachments get individual copies per page.

## Filesystem Structure

### Native (Android and iOS)

```text
{documentDirectory}/canto/
├── journals.json
├── {journalId}/
│   ├── metadata.json
│   ├── pages/
│   │   └── {pageId}.json
│   └── attachments/
│       └── [e]{img|fl}-{pageId}-{hash}.{ext}
```

Attachment naming uses `{encPrefix}{typePrefix}-{pageId}-{hash}.{ext}` where `e` means password-encrypted and `img` or `fl` indicates the attachment type.

### Web (IndexedDB)

```text
Database: 'canto' (version 1), Object store: 'files' (keyPath: 'path')

Virtual paths mirror native layout:
  canto/journals.json
  canto/{journalId}/metadata.json
  canto/{journalId}/pages/{pageId}.json
  canto/{journalId}/attachments/{typePrefix}-{pageId}-{hash}.{ext}
```

### Google Drive

All journal content on Google Drive is AES-256-GCM encrypted before upload. Only the registry and sync index are stored unencrypted.

```text
My Drive/Canto/
├── {journalId}/
│   ├── meta.json
│   ├── index.json
│   ├── pages/{pageId}.json
│   └── attachments/{filename}
App Data (hidden):
└── canto-journals.json
```

## Development

```bash
git clone https://github.com/pboueke/canto-data.git
cd canto-data
npm install
npm test
npm run test:ci
npm run build
```

The repository requires `100%` test coverage. Local hooks keep the README version, test count, and coverage badges in sync with the current test suite.

Release versioning is derived from the top entry in [CHANGELOG.md](CHANGELOG.md). The pre-commit hook syncs `package.json` and the README version badge from that changelog entry automatically.

## License

MIT. See [LICENSE](LICENSE).
