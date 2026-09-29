---
title: Schema versions
description: The Canto journal schema version policy, current version and migration history.
---

## Policy

Canto journal schemas follow [semver](https://semver.org/):

| Change                                 | Component | Migration needed |
| -------------------------------------- | --------- | ---------------- |
| Breaking (field removed, type changed) | MAJOR     | Yes              |
| New optional field                     | MINOR     | No               |
| Documentation or validation fix        | PATCH     | No               |

The schema version is stored in `JournalContent.schemaVersion` and
`ExportManifest.schemaVersion`. Legacy data without a `schemaVersion` is treated
as `0.16.0`. Migrations are forward-only: older data is upgraded, future data is
rejected.

## Current version

```ts
import { SCHEMA_VERSION } from 'canto-data';
```

`SCHEMA_VERSION` is the single authored version readers should compare against
(`0.19.0` at the time of writing). `needsMigration(version)` reports whether a
version is strictly older, and `isFutureVersion(version)` whether a reader
cannot open it.

## Migration history

| From   | To     | Description                                           |
| ------ | ------ | ----------------------------------------------------- |
| 0.16.0 | 0.17.0 | Remove deprecated `showMarkdownPlaceholder` setting   |
| 0.17.0 | 0.18.0 | No-op additive attachment-content descriptor schema   |
| 0.18.0 | 0.19.0 | No-op additive chunked attachment generation metadata |

The `0.17.0` and `0.18.0` steps are additive: descriptor-absent attachments
remain valid, and the migration returns the data unchanged so a version bump
never rewrites content by itself.

## Migrating

```ts
import { migrateIfNeeded, isFutureVersion } from 'canto-data';

if (isFutureVersion(journal.schemaVersion)) {
  throw new Error('This reader is too old for that journal');
}

const { data, migrated, toVersion } = migrateIfNeeded(journal, journal.schemaVersion);
```

`migrateIfNeeded`:

- defaults `fromVersion` to `0.16.0` when it is omitted;
- walks every registered migration in order and reports the `fromVersion` /
  `toVersion` it applied;
- throws when the version is in the future instead of guessing a downgrade;
- throws when no migration path connects the input version to the current one.

See [Usage](/canto-data/usage/) for the surrounding validation flow.
