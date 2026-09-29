---
title: Relationship to the Canto app
description: How canto-data relates to the Canto app, its licensing and its ownership boundaries.
---

The Canto app lives at [pboueke.github.io/canto](https://pboueke.github.io/canto/)
([source](https://github.com/pboueke/canto)). Canto (the app) is GPLv3-licensed.
`canto-data` (this library) is MIT-licensed to enable data portability: anyone
can build tools that interoperate with Canto journals without being bound by the
app's copyleft license.

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

## What canto-data owns

- All journal data types (Journal, Page, Attachment, Comment, and related
  structures)
- Runtime validation and type guards
- Schema versioning and migration framework
- Export format specification (manifest structure and attachment naming)

## What it does not include

- Encryption and decryption
- Attachment storage, chunk I/O, and byte reassembly
- Sync integrations and remote uploads
- UI components

Those pieces live in the [Canto app](https://pboueke.github.io/canto/) — the
app also documents its encryption model in
[SECURITY.md](https://github.com/pboueke/canto/blob/main/SECURITY.md).

The library is MIT-licensed; see
[LICENSE](https://github.com/pboueke/canto-data/blob/main/LICENSE). The Canto
app is a separate GPLv3 project, so the two licenses stay independent: this
package ships no app code.
