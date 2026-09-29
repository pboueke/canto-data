# canto-data

Data model library for [Canto](https://pboueke.github.io/canto/), a private
encrypted journaling app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.2.1-green)
![Tests](https://img.shields.io/badge/tests-441%2F441%20passed-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

`canto-data` provides TypeScript types, runtime validation, schema versioning,
migration infrastructure and export format utilities for Canto journals. It
defines attachment metadata only; it does not encrypt, store, stream or upload
attachment bytes.

MIT-licensed, zero runtime dependencies, Node.js 18+. Use it independently of
the Canto app to read, validate and manipulate Canto journal data.

## Install

```bash
npm install canto-data
```

## Quick start

```ts
import { validateJournalContent, ValidationError } from 'canto-data';

try {
  const journal = validateJournalContent(untrustedData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Field: ${error.field}`);
    console.error(`Expected: ${error.expected}, got: ${error.received}`);
  }
}
```

```ts
import { migrateIfNeeded, parseManifest } from 'canto-data';

const manifest = parseManifest(manifestJsonString);
const result = migrateIfNeeded(rawData, manifest.schemaVersion);

if (result.migrated) {
  console.log(`Migrated from ${result.fromVersion} to ${result.toVersion}`);
}
```

## Documentation

The full reference is published at
**[pboueke.github.io/canto-data](https://pboueke.github.io/canto-data/)**:

| Page                                                                              | Covers                                        |
| --------------------------------------------------------------------------------- | --------------------------------------------- |
| [Getting started](https://pboueke.github.io/canto-data/getting-started/)          | install, validation, first migration          |
| [Data model](https://pboueke.github.io/canto-data/data-model/)                    | the complete `JournalContent` tree            |
| [Usage](https://pboueke.github.io/canto-data/usage/)                              | guards, serialization, attachments            |
| [Export format](https://pboueke.github.io/canto-data/export-format/)              | archives, manifests, content descriptors      |
| [Schema versions](https://pboueke.github.io/canto-data/schema/)                   | semver policy and migration history           |
| [API](https://pboueke.github.io/canto-data/api/)                                  | every export and subpath                      |
| [Canto app storage](https://pboueke.github.io/canto-data/storage/)                | native, IndexedDB and Drive layouts           |
| [Relationship to the app](https://pboueke.github.io/canto-data/relationship/)     | licensing and the library boundary            |
| [Development and verification](https://pboueke.github.io/canto-data/development/) | `make` targets, support matrix, release steps |

## Development

`make verify` is the authoritative gate and runs in pinned rootless Podman
containers. See [CONTRIBUTING.md](CONTRIBUTING.md),
[AGENTS.md](AGENTS.md) and the
[development page](https://pboueke.github.io/canto-data/development/).

## License

MIT. See [LICENSE](LICENSE).
