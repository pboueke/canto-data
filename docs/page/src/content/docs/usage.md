---
title: Usage
description: Validation, type guards, serialization and migration with canto-data.
---

## Validation

Validators are strict: they check every field, drop nothing silently and throw a
`ValidationError` carrying the failing `field`, the `expected` shape and the
`received` value.

```ts
import { validatePage, validateJournalContent, ValidationError } from 'canto-data';

validatePage(page);
validateJournalContent(journal);

try {
  validatePage(candidate);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`${error.field}: expected ${error.expected}, got ${error.received}`);
  }
}
```

`validatePage` and `validateAttachment` accept an optional path prefix so
callers can report the exact location in a larger document.

## Type guards

Guards answer "can this value be treated as the type" without throwing. They are
deliberately shallow, so a guard may accept a value the matching validator then
rejects with a precise field error:

```ts
import { isPage, isJournalContent, isChunkedAttachmentContent } from 'canto-data';

if (isPage(candidate)) {
  // narrower, but still validate before persisting
  validatePage(candidate);
}
```

## Migration

`schemaVersion` may be absent on legacy data; it is treated as `0.16.0`.
`migrateIfNeeded` walks the registered migrations forward to the current
version and never mutates the input in place for the caller's benefit — the
migrated data is returned in the result:

```ts
import { migrateIfNeeded, needsMigration, isFutureVersion } from 'canto-data';

const result = migrateIfNeeded(journal, journal.schemaVersion);
// { data, migrated, fromVersion, toVersion }

if (needsMigration(journal.schemaVersion)) {
  journal = migrateIfNeeded(journal, journal.schemaVersion).data;
}
if (isFutureVersion(journal.schemaVersion)) {
  throw new Error('This reader is too old for that journal');
}
```

A future version throws rather than being downgraded, and a version with no
migration path throws a path error naming both endpoints. See
[Schema versions](/canto-data/schema/).

## Serialization

`serializePages` turns pages into a `Map<pageId, json>` and `deserializePages`
validates and restores them:

```ts
import { serializePages, deserializePages } from 'canto-data';

const stored = serializePages(pages); // Map<string, string>
const restored = deserializePages(stored); // Page[]
```

## Attachments

Attachment bytes are never read, written or decrypted. The library works with
the metadata and the archive mapping:

```ts
import { collectAttachmentEntries, rewriteAttachmentPaths } from 'canto-data';

const entries = collectAttachmentEntries(pages);
// { zipFilename, diskPath, isPasswordEncrypted, content? }[]

const exported = rewriteAttachmentPaths(
  pages,
  new Map(entries.map((entry) => [entry.diskPath, entry.zipFilename])),
);
```

`collectAttachmentEntries` skips deleted attachments and de-duplicates repeated
disk paths. See the [export format](/canto-data/export-format/) for what happens
to a chunked attachment's `content` descriptor during rewriting.
