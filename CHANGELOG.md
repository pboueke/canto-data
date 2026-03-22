# Changelog

## v1.0.3 - Remove CI badges from README

- docs: remove GitHub Actions CI badges from the README while keeping version, test, and coverage badges

## v1.0.2 - CI badge fix and workflow consistency checks

- fix: pin README GitHub Actions badges to explicit branch and event parameters so pull request failures are visible instead of inheriting the default-branch push status
- ci: add repository verification step that checks changelog-driven version sync and README badge freshness in GitHub Actions
- ci: align publish validation with the same repository verification gate used in CI
- chore: make local `prepublishOnly` enforce the same repo verification rules as CI
- chore: stop the publish workflow from creating git tags automatically; release tagging is now manual

## v1.0.1 - Docs consolidation, changelog-driven versioning, and repo automation

- docs: merge `DATA.md` into `README.md` and remove the separate data reference file
- docs: remove npm publishing instructions from the README and add repo-standard test and coverage badges
- docs: add this changelog in the same release-note style as the main `canto` repository
- chore: derive package version and README version badge from the top changelog entry via the pre-commit hook
- chore: add Husky, lint-staged, and Prettier-based local automation aligned with repo standards
- chore: add pre-commit and pre-push hooks that sync badges, enforce build success, and require `100%` coverage
- ci: update publish workflow to use the coverage-enforced test command

## v1.0.0 - Initial standalone release

- feat: extract Canto's journal data model into the standalone `canto-data` package
- feat: publish TypeScript types for journals, pages, attachments, comments, settings, and related structures
- feat: add runtime validation utilities for untrusted journal data and export manifests
- feat: add schema-version helpers and forward-only migration infrastructure
- feat: add export format utilities for Canto archive manifests
- docs: consolidate package documentation into README.md with data model, export format, and filesystem reference
- test: full automated suite for validation, version helpers, migration flow, types, and format utilities
- test: enforce `100%` statements, branches, functions, and lines coverage in CI and local hooks
- chore: add Husky pre-commit and pre-push hooks to sync repo badges and enforce release quality gates
