# Changelog

## v1.2.1 - Reproducible verification toolkit

- build: run every gate in digest-pinned rootless Podman images instead of host tooling
- build: compose the npm leaf commands through Make targets with a single `make verify` gate
- chore: adopt ESLint and Prettier with an absolute 100% coverage inventory over the barrel and tooling
- chore: replace Husky and lint-staged with opt-in, read-only `.githooks` backed by Make
- test: add committed contract fixtures, installed-tarball consumers on Node 18/20/22/24 and a headless-Chromium bundler gate
- test: cover the executable helpers at 100% with dependency-injected tests
- ci: run the shared gate on GitHub Actions with commit-pinned actions and upload reports as evidence
- ci: replace the credential-holding publish workflow with an owner-run interactive `release.sh`
- ci: add a tag-only workflow that never publishes or moves an existing tag
- ci: remove the Carranca reviewer and its CI-scoped inputs
- docs: publish a Starlight documentation site to GitHub Pages
- docs: reduce the README to badges, install, a quick start and an index of the published documentation
- fix: fail closed on HIGH/CRITICAL advisories and keep the locked graph free of known findings
- docs: add portable agent guidance, spec conventions and per-element documentation

## v1.2.0 - Atomic chunk generations

- feat: add optional `Attachment.content.generation` so remote chunk generations can publish atomically without overwriting the previously published attachment
- feat: advance schema to `0.19.0` with a no-op `0.18.0 → 0.19.0` migration

## v1.1.0 - Chunked attachment-content contract

- feat: add an optional, validated `Attachment.content` descriptor for `canto-chunked-v1` metadata while preserving legacy monolithic attachments
- feat: advance the journal/export schema to `0.18.0` with a no-op `0.17.0 → 0.18.0` migration
- feat: retain the flat archive-v1 payload contract by omitting local chunk descriptors when attachment paths are rewritten for ZIP export
- docs: clarify that this package owns metadata validation only and does not implement storage, crypto, chunk I/O, or sync

## v1.0.4 - Carranca CI and container configuration

- ci: add GitHub Actions PR review workflow using carranca-sandboxed AI reviewer
- chore: add claude, opencode, and reviewer agents to carranca configuration
- chore: add environment passthrough for OPENAI_API_KEY in carranca config
- chore: install claude-code, opencode-ai, and python3 in the carranca container

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
