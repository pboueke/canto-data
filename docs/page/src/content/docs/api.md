---
title: API
description: Every public export and the subpath it lives in.
---

The package root re-exports every runtime value below. Each concern is also a
subpath export, so consumers can import only what they need.

## `canto-data` — root barrel

Everything below, re-exported for convenience.

## `canto-data/types`

| Export                                                        | Kind  | Description                                    |
| ------------------------------------------------------------- | ----- | ---------------------------------------------- |
| `CHUNKED_ATTACHMENT_CONTENT_FORMAT`                           | value | The `'canto-chunked-v1'` descriptor format tag |
| `DEFAULT_JOURNAL_SETTINGS`                                    | value | Default journal settings                       |
| `pageToPreview`                                               | value | Build a `PagePreview` from a page              |
| `Attachment`, `AttachmentContent`, `ChunkedAttachmentContent` | type  | Attachment metadata and chunked descriptor     |
| `Comment`, `GeoLocation`, `Page`, `PagePreview`               | type  | Page-level structures                          |
| `Journal`, `JournalContent`, `JournalSettings`                | type  | Journal structures                             |
| `Filter`, `SyncProvider`                                      | type  | Shared enumerations                            |

## `canto-data/version`

| Export            | Kind  | Description                                  |
| ----------------- | ----- | -------------------------------------------- |
| `SCHEMA_VERSION`  | value | The current schema version                   |
| `compareVersions` | value | Semver comparison returning `-1`, `0` or `1` |
| `needsMigration`  | value | True when a version is strictly older        |
| `isFutureVersion` | value | True when a version is newer than current    |
| `isMajorUpgrade`  | value | True when two versions differ in major       |

## `canto-data/validation`

| Export                                                                                                                                                                                     | Kind  | Description                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------------------------------------------- |
| `ValidationError`                                                                                                                                                                          | value | Error carrying `field`, `expected`, `received` |
| `isGeoLocation`, `isComment`, `isAttachment`, `isChunkedAttachmentContent`, `isPage`, `isJournal`, `isJournalContent`                                                                      | value | Non-throwing type guards                       |
| `validateGeoLocation`, `validateComment`, `validateAttachment`, `validateChunkedAttachmentContent`, `validatePage`, `validateJournalSettings`, `validateJournal`, `validateJournalContent` | value | Strict validators that throw `ValidationError` |

## `canto-data/migration`

| Export                         | Kind  | Description                                   |
| ------------------------------ | ----- | --------------------------------------------- |
| `migrateIfNeeded`              | value | Walk forward migrations and report the result |
| `Migration`, `MigrationResult` | type  | Migration contract and result shape           |

## `canto-data/format`

| Export                                                      | Kind  | Description                              |
| ----------------------------------------------------------- | ----- | ---------------------------------------- |
| `buildExportManifest`                                       | value | Create an export manifest                |
| `parseManifest`                                             | value | Parse and validate a manifest            |
| `collectAttachmentEntries`                                  | value | Portable archive entries for a page list |
| `rewriteAttachmentPaths`                                    | value | Copy pages with archive member paths     |
| `serializePages`                                            | value | Serialize pages to `Map<pageId, json>`   |
| `deserializePages`                                          | value | Validate and restore serialized pages    |
| `ExportManifest`, `AttachmentEntry`, `BuildManifestOptions` | type  | Manifest and archive shapes              |
