---
title: Export format
description: The .canto.zip archive, manifests, attachment entries and archive path rewriting.
---

## Archive layout

A `.canto.zip` export contains one manifest, the journal payload and one raw
member per attachment:

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

## Reading an export

Example: list all entries from an unencrypted export.

```ts
import JSZip from 'jszip';
import { parseManifest } from 'canto-data';
import type { Page } from 'canto-data';

const zip = await JSZip.loadAsync(zipBuffer);
const manifest = parseManifest(await zip.file('manifest.json')!.async('string'));

if (manifest.encrypted) {
  console.log('This export is encrypted and requires the journal password.');
} else {
  const pageFiles = zip.file(/^pages\/.*\.json$/);
  for (const pf of pageFiles) {
    const page: Page = JSON.parse(await pf.async('string'));
    console.log(`${page.date}: ${page.text.substring(0, 80)}...`);
  }
}
```

## `manifest.json`

```json
{
  "version": 1,
  "schemaVersion": "0.19.0",
  "appVersion": "1.2.0",
  "exportDate": "2026-01-01T00:00:00.000Z",
  "encrypted": false,
  "journalTitle": "My Journal",
  "salt": "base64...",
  "kdfIterations": 50000
}
```

- `version`: Manifest format version, always `1`
- `schemaVersion`: Journal schema version; absent in legacy exports and treated
  as `0.16.0`
- `appVersion`: The exporting app's own version; it stays independent of the
  schema
- `encrypted`: If `true`, all JSON and attachment content is AES-256-GCM
  encrypted
- `salt` and `kdfIterations`: Present for password-protected journals

`buildExportManifest` creates the manifest from journal metadata and a caller
supplied `appVersion`. `parseManifest` reads one back and:

- drops unknown fields, so a future export does not break an older reader;
- treats a missing `schemaVersion` as `0.16.0`;
- rejects `version` values other than `1`;
- rejects invalid JSON and non-object payloads with a `ValidationError` naming
  `manifest`.

## Archive members

Archive format version `1` stays flat: each attachment is one reconstructed raw
member named `attachments/{type}-{id}.{ext}`. `collectAttachmentEntries` returns
that mapping:

```ts
import { collectAttachmentEntries, rewriteAttachmentPaths } from 'canto-data';

const entries = collectAttachmentEntries(pages);
const exported = rewriteAttachmentPaths(
  pages,
  new Map(entries.map((entry) => [entry.diskPath, entry.zipFilename])),
);
```

Rewriting is a copy, not a mutation, and attachments whose path is not in the
map keep every property. A rewritten attachment loses its local `content`
descriptor, because the flat archive member is the whole reconstructed payload —
a chunked attachment's descriptor describes local chunk layout, not the archive.
Old v1 archives and descriptor-absent attachments remain readable.

## Attachment content descriptors

An attachment may carry an optional `content` descriptor for chunked attachment
content; absence means legacy monolithic bytes:

```ts
interface ChunkedAttachmentContent {
  format: 'canto-chunked-v1';
  byteLength: number; // exact plaintext bytes
  chunkSize: number; // maximum plaintext bytes per chunk
  chunkCount: number; // ceil(byteLength / chunkSize)
  generation?: string; // opaque remote generation
}
```

`validateChunkedAttachmentContent` checks the arithmetic and rejects an empty
generation; `isChunkedAttachmentContent` is the guard. The descriptor is metadata
only: this package does not encrypt, store, stream or upload bytes, and it
defines no remote upload contract.

## Encryption

For [Canto app](https://pboueke.github.io/canto/) exports, when `encrypted: true`
decryption requires the journal password. The ciphertext format is
`[12-byte nonce][ciphertext][16-byte GCM tag]` using AES-256-GCM. This library
does not perform that encryption or decryption; see
[Canto SECURITY.md](https://github.com/pboueke/canto/blob/main/SECURITY.md) for
the full encryption model.

## Import behavior

Importing always creates a new journal with new UUIDs, so re-importing the same
archive is safe. Shared attachments get individual copies per page.
