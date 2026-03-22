# canto-data

[![npm version](https://img.shields.io/npm/v/canto-data.svg)](https://www.npmjs.com/package/canto-data)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/pboueke/canto-data/actions/workflows/ci.yml/badge.svg)](https://github.com/pboueke/canto-data/actions/workflows/ci.yml)

Data model library for [Canto](https://github.com/pboueke/canto), a private encrypted journaling app. Provides TypeScript types, runtime validation, schema versioning, migration infrastructure, and export format utilities for Canto journals.

**MIT-licensed** with **zero dependencies** — use it to build tools that read, validate, or manipulate Canto journals without copyleft obligations.

## Installation

```bash
npm install canto-data
```

## Quick Start

```typescript
import {
  type JournalContent,
  type Page,
  SCHEMA_VERSION,
  validateJournalContent,
  ValidationError,
  parseManifest,
  migrateIfNeeded,
} from 'canto-data';

// Validate untrusted journal data
try {
  const journal = validateJournalContent(untrustedData);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`${err.field}: expected ${err.expected}, got ${err.received}`);
  }
}

// Parse an export manifest
const manifest = parseManifest(manifestJsonString);

// Migrate data to latest schema
const result = migrateIfNeeded(rawData, manifest.schemaVersion);
```

## Documentation

See **[DATA.md](DATA.md)** for the full data model reference, export format specification, filesystem structure, and usage examples.

## Development

```bash
git clone https://github.com/pboueke/canto-data.git
cd canto-data
npm install
npm test            # run tests
npm run test:ci     # run tests with 100% coverage enforcement
npm run build       # compile to dist/
```

## Publishing

See the [npm Publishing Setup](#npm-publishing-setup) section below.

### npm Publishing Setup

1. **npm account**: Create/login at [npmjs.com](https://www.npmjs.com/signup)
2. **npm token**: Generate an automation token at npmjs.com > Access Tokens > Generate New Token (Automation)
3. **GitHub secret**: Add the token as `NPM_TOKEN` in the repo's Settings > Secrets and variables > Actions
4. **First publish**: Run `npm run build && npm publish` after `npm login`, or push v1.0.0 to main
5. **Subsequent publishes**: Bump version in `package.json`, merge to `main` — GitHub Actions auto-publishes

### Version bump

```bash
npm version patch   # 1.0.0 -> 1.0.1 (bug fix)
npm version minor   # 1.0.0 -> 1.1.0 (new feature)
npm version major   # 1.0.0 -> 2.0.0 (breaking change)
git push && git push --tags
```

## License

MIT — see [LICENSE](LICENSE).
