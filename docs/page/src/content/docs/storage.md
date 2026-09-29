---
title: Canto app storage
description: How the Canto app stores journals on native, web and Google Drive — for reference only.
---

This page documents where the [Canto app](https://pboueke.github.io/canto/) keeps
its data. It is app storage documentation only: `canto-data` does not implement
any of these storage backends, and reading a journal on disk is a plain
[canto-data validation](/canto-data/usage/) exercise.

## Native (Android and iOS)

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

Attachment naming uses `{encPrefix}{typePrefix}-{pageId}-{hash}.{ext}` where `e`
means password-encrypted and `img` or `fl` indicates the attachment type.

## Web (IndexedDB)

```text
Database: 'canto' (version 1), Object store: 'files' (keyPath: 'path')

Virtual paths mirror native layout:
  canto/journals.json
  canto/{journalId}/metadata.json
  canto/{journalId}/pages/{pageId}.json
  canto/{journalId}/attachments/{typePrefix}-{pageId}-{hash}.{ext}
```

## Google Drive

The Canto app encrypts journal content with AES-256-GCM before Google Drive
upload. Only the registry and sync index are stored unencrypted; `canto-data`
has no Drive behavior.

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

## What this means for library users

- The library validates and migrates the JSON payloads; it never opens these
  directories and never touches attachment bytes.
- Encrypted journals stay opaque until the app (or another GPLv3-compatible
  tool) decrypts them; see the
  [encryption notes](/canto-data/export-format/#encryption).
- The [export archive format](/canto-data/export-format/) is the interchange
  surface this package specifies and supports.
