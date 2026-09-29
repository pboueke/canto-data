---
title: Data model
description: The complete JournalContent data model, field by field.
---

Every structure is declared as a TypeScript interface in `canto-data/types`.
Optional fields are marked with `?`; timestamps are ISO 8601 strings.

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
    │   ├── deleted: boolean
    │   └── content?: AttachmentContent (absent for legacy monolithic bytes)
    │       ├── format: 'canto-chunked-v1'
    │       ├── byteLength: number (exact plaintext bytes)
    │       ├── chunkSize: number (maximum plaintext bytes per chunk)
    │       └── chunkCount: number (ceil(byteLength / chunkSize))
    └── files: Attachment[]
        └── same fields as images, with type: 'file'
```

## Notes

- `schemaVersion` is optional for legacy data; readers treat it as `0.16.0` and
  [migrate forward](/canto-data/schema/).
- `version` is deprecated and always `1`; `schemaVersion` carries the real
  version.
- `DEFAULT_JOURNAL_SETTINGS` provides the default `settings` object, and
  `pageToPreview` derives a `PagePreview` from a page.
- An attachment's optional `content` descriptor describes local chunked layout
  only; absence means legacy monolithic bytes. See
  [export format](/canto-data/export-format/) for how it behaves in an archive.
