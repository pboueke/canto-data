# 001 - Adopt reproducible library development for canto-data

## Why

Strengthen this existing repository in place: make local and CI verification
reproducible, verify the package consumers actually install, and record intent
before implementation. Preserve `canto-data` as an MIT-licensed TypeScript library
with zero runtime dependencies for Canto data portability, not an application or
service. Keep its public API, package identity, Git history and release history.

The adoption uses the library-focused practices demonstrated by
[QuaterniTS](https://github.com/pboueke/QuaterniTS), reviewed in the sibling
`quaternity.js` checkout: a pinned toolkit, Make-backed gates, installed-package
checks, portable agent guidance and explicit spec approval. Adapt those
practices; do not copy its game rules, snapshot schema, release history or
product identifiers.

### Observed baseline

Inspected revision: `363f7ccbdffc75cfe94507d9078422d048554219`.

- TypeScript strict mode, CommonJS output and declarations, npm lockfile,
  Jest/ts-jest and Prettier. No runtime dependencies or HTTP service.
- Package and README version: `1.0.4`. Both root package-lock version fields
  still say `1.0.0`. The existing verification script does not detect this drift.
- Journal `SCHEMA_VERSION` is `0.17.0`; legacy data defaults to `0.16.0`.
  These are not package release versions.
- In a disposable copy, `npm ci --ignore-scripts --no-audit --no-fund`,
  `npm run test:ci -- --runInBand` and `npm run build` succeeded on Node
  `24.14.0` / npm `11.9.0`: **156 tests in six suites, 100% statements,
  branches, functions and lines in the configured scope**. This is a local
  baseline, not evidence of the proposed toolkit or a CI run.
- Coverage includes source files not imported by tests, but explicitly excludes
  `src/index.ts`; repository automation is outside the coverage gate.
- Husky pre-commit rewrites and stages metadata and runs lint-staged. Pre-push
  runs build and tests without fail-fast handling. There is no Makefile,
  ESLint configuration, spec workflow or portable `AGENTS.md`.
- GitHub Actions tests Node 18/20/22. Publishing automatically follows a version
  change on `main`. Carranca supplies a separate AI review workflow and
  repository-default local agent configuration.

## Scope

Adopt the following elements as one library-specific system. "Omit" means do
not import a reference element, not delete existing product code.

| Element                      | Choice and adaptation                                                             | Decision |
| ---------------------------- | --------------------------------------------------------------------------------- | -------- |
| Application source           | Keep `src/`, migrations and Jest tests; verify every public entry point           | D3       |
| Reference hello-world        | Omit Python service code and its tests entirely                                   | D4       |
| Documentation                | Keep README as the product reference; add element usage/replacement documentation | D5       |
| HTTP/OpenAPI contract        | Swap for checked-in data fixtures and installed-package contract checks           | D6       |
| Spec workflow                | Keep local active/archive layout and append-only decisions                        | D7       |
| Development toolkit          | Swap Python tools for pinned Node/npm, Jest, TypeScript, Prettier and ESLint      | D8       |
| Live-stack integration       | Swap for installed-tarball lifecycle and real-browser consumer tests              | D9       |
| Git hooks                    | Replace Husky/lint-staged with opt-in, Make-backed `.githooks`                    | D10      |
| Application containers/stack | Omit; toolkit/browser containers are development tools only                       | D11      |
| Agent sandbox                | Retain Carranca for CI review only; remove default local binding; no new sandbox  | D12      |
| Agent configuration          | Use portable `AGENTS.md`, without a mandatory agent-specific configuration        | D13      |

Also adopt complete coverage inventory, fail-closed dependency auditing,
changelog/metadata synchronization, shared CI verification and owner-triggered
publication. Keep one authority per concern throughout migration.

## Out of scope

- New journal features, schema changes, validation-policy tightening, encryption,
  storage, sync, UI, ZIP compression/decompression or application deployment.
- Turning CommonJS output into a mandatory dual ESM/CommonJS distribution.
- A second, independently authored JSON Schema or OpenAPI contract.
- Migrating repositories, resetting history, renaming the package or changing
  its MIT license or zero-runtime-dependency promise.
- A replacement agent sandbox, socket proxy, broker, local agent installer or
  new standing requirement to use Carranca for development.
- Changes to Canto, Canto Tools or QuaterniTS. Consumer fixtures are self-contained
  in this repository; sibling checkouts are not build prerequisites.
- Publishing, tagging or implementing anything as part of the spec-only change.

## Requirements

### R1. Preserve the library and its contracts

Keep the root export and existing `/types`, `/format`, `/version`, `/validation`
and `/migration` subpaths, declaration resolution and CommonJS consumers
working. Verify Node ESM interoperability with the existing distribution rather
than claiming native ESM output. Preserve the advertised Node `>=18` floor;
exercise Node 18, 20, 22 and the selected toolkit runtime with packaged-consumer
tests. Old runtime compatibility does not imply those runtimes remain suitable
as the development or release toolchain.

Create synthetic, committed valid/invalid/legacy fixtures for journal and page
validation, manifest parsing, migrations, attachment collection/path rewriting
and page serialization. Expected results cover legacy `0.16.0` migration to
`0.17.0`, current data, future-version rejection, missing migration paths and
representative `ValidationError` fields. Distinguish shallow type guards from
structural validators; do not silently make their acceptance policies identical.

The existing types, validators and migration registry remain the implementation
authority. Fixtures assert reviewed compatibility outcomes, including existing
permissive behavior; changing those outcomes needs an explicit decision and
regression test, not an incidental tooling refactor. Control clocks in fixtures
where needed without promising byte-identical time-dependent exports.

### R2. One reproducible verification interface

Use a digest-pinned Node 24 toolkit with frozen `npm ci` and rootless Podman.
Resolve actual image digests during implementation; do not copy stale pins or
invent hashes. Pin the browser image and matching Playwright driver together.
Use `canto-data-*` image/cache names, disposable containers, non-root execution
and host-user-compatible output ownership. Gates require only Git, bash, make
and rootless Podman on the host; interactive native npm use is not gate evidence.

The root Makefile is a discoverable map of documented element fragments.
Provide `help`, `preflight`, `toolkit-build`, `fmt`, `fmt-check`, `lint`, `types`,
`test`, `build`, `contract-check`, `consumer-test`, `integration`,
`browser-consumer`, `audit`, `version-check`, `version-sync`, `badges-check`,
`badges-sync`, `hooks-install` and `verify`. Reuse npm scripts as leaf commands,
not as a competing gate definition. Formatting covers maintained TS/JS, JSON,
Markdown and YAML; check shell logic with ShellCheck and behavioral tests.

`make verify` runs every required gate: format, lint, strict type checks,
coverage, version/badge checks, build, contract fixtures, consumer compatibility,
installed-package integration, browser checks and dependency audit. Shared
prerequisites may run once. Missing tools, images, fixtures, report data or browser
binaries fail visibly. Preflight must reject an unusable or non-rootless runtime.
Verification may write ignored build/test outputs, but never tracked files,
versions, badges, the index or Git configuration.

Require **100% statements, branches, functions and lines** over all maintained
production TS/JS, including `src/index.ts` and executable tooling helpers. Keep
Jest; extend its scope rather than replacing the runner merely to match another
repo. Include unimported files and fail on inventory gaps. Test/declaration files
and generated outputs are outside production coverage; configuration-only files
are checked as configuration, not a loophole for executable helper logic. No
coverage-ignore pragmas, grandfather baselines, silent skips or reduced floors.
Test shell hooks, installers and orchestration behavior, including failure paths.

Run `npm audit` across the locked dependency graph, including development tools.
Block HIGH/CRITICAL findings without a valid exception; registry failures,
malformed reports and expired exceptions fail closed. Any exception needs a reviewed advisory ID,
reason and expiry. This is a dependency gate, not a claim to scan OS images.

### R3. Prove the installed artifact

Build from clean output, pack the library, and install the resulting tarball in
a disposable consumer outside the repository. Consumers must not resolve source
files or use workspace/path aliases back into the checkout.

- CommonJS and Node ESM consumers exercise the root and every runtime subpath.
  Positive and negative TypeScript consumers check declarations under relevant
  module-resolution modes; expected negative diagnostics must be type errors,
  not missing-module failures. The type-only subpath must resolve as documented.
- An integration fixture drives the public API through legacy migration,
  validation, attachment mapping, serialization/deserialization and manifest
  construction/parsing, asserting the resulting data and preservation behavior.
- Bundle the installed CommonJS package with a pinned dev-only bundler and run
  it in real headless Chromium. Exercise representative validation, migration
  and export helpers without Node globals, filesystem/network dependencies or
  remote assets. This proves browser bundler use, not native unbundled ESM.
- Bound browser/server startup and teardown. Test failure propagation for an
  unavailable browser, failed assertion and broken package entry point. Browser
  execution is offline after dependency/image preparation.
- Inspect tarball contents: documented runtime files and declarations plus
  package metadata/license/docs as intended; no tests, coverage, CI credentials,
  agent scripts or new runtime dependencies. Execute relevant README examples
  using synthetic inputs, identifying any example-only dependency explicitly.

### R4. Continue version history without hidden mutations

`CHANGELOG.md` remains the sole authored **package release version**, retaining
`## vX.Y.Z - description` headings and all existing entries unchanged. New
entries advance monotonically and use typed release notes; verify bump size
against declared breaking changes/features/fixes without reinterpreting old
history. Resolve comparison bases explicitly in CI/hooks; a missing base must
not silently disable the check. Spec-only approval is exempt from requiring a
release bump, not from applicable verification.

`version-sync` updates `package.json`, both root `package-lock.json` version
fields and the README version badge. `badges-sync` derives the existing test
and coverage badges from successful machine-readable test results, not rounded
or partially parsed console output. Check commands are read-only. Keep schema
`0.17.0`, manifest format `1` and caller-supplied `appVersion` independent of
package release bumps. Correct the observed lockfile drift during implementation.

Hooks never auto-stage. Pre-commit checks the staged change set, runs fast checks
where safely scoped and fails with actionable commands if metadata needs
synchronization. Reject ambiguous partially staged metadata; never replace the
index with the worktree. Pre-push runs full `make verify` with fail-fast exit
propagation. The installer is explicit, repository-local and idempotent, and
refuses to overwrite a different configured hook path without owner action.
Remove Husky's `prepare`, lint-staged configuration/dependencies and `.husky`
only as the replacement becomes authoritative. No hook installs during `npm ci`.

Local hooks are convenience controls, not a security boundary: they can be
bypassed and worktree results may not describe staged/pushed commits. CI from a
fresh checkout is the backstop; document owner-managed required-check settings.

### R5. CI, review and owner-triggered publication

PR and `main` CI run the same rootless toolkit `make verify` from a fresh
checkout, including the Node compatibility and browser legs. Use minimal
permissions and immutable action/tool pins. Do not run PR code with release
credentials. CI evidence must identify the tested revision; a local green run
is not a CI result.

Retain `.github/workflows/pr-review.yml` and Carranca **only as a CI reviewer**.
Move its necessary configuration, container inputs and wrappers into an
explicitly CI-scoped location. Remove root `.carranca.yml`/`.carranca/` default
bindings after the workflow consumes the relocated inputs. Ordinary checkout,
install, hooks and verification must not select an agent, install an agent CLI,
forward model credentials or require Carranca. Do not add another sandbox.

The reviewer is advisory, not a replacement for deterministic gates. Preserve
its restricted eligibility; expose model credentials only to a trusted,
explicit CI review context, never arbitrary fork code. Pass PR metadata as data
rather than interpolating it into shell programs, and treat diffs as untrusted
review input. Pin Carranca and reviewer installation inputs, document their
separate environment, and report failed/truncated reviews honestly. The reviewer
must not publish packages or mutate the PR branch. Its existing credentialed
network access is a CI-only exception, not part of the offline library tests or
a claim of new sandbox guarantees.

Replace automatic version-change publishing with owner-triggered release
execution against an explicit trusted `main` revision. Run the full shared gate,
check version/history and package contents, then publish **the exact tested
tarball**, not a subsequently rebuilt artifact. Preserve its checksum/provenance
and prevent a duplicate version from being treated as a successful new release.
Keep credentials confined to the publish step; make `prepublishOnly` and release
commands consistent so lifecycle scripts cannot bypass gates or recurse.
Tagging stays manual. Agents do not commit, push, tag, revert or publish.
Publication itself is not required to complete this adoption.

### R6. Intent-first workflow and ordered migration

Implement only after this spec-only PR merges, or an owner explicitly uses a
solo spec-only approval commit. Allocate local numbers across active/archive
specs; this is `001` because no prior local specs exist. Decisions are
append-only, cited as `001/D<n>`; later reversals cite the old decision. Archive only
once completion evidence exists. Keep specs repo-only. The spec links outward
to implementation evidence; moving it must not break hard-coded source links.

Migrate in reviewable stages, each leaving one authority per concern:

1. Add portable guidance, spec conventions and element documentation. Establish
   pinned toolkit/Make targets over the existing Jest/Prettier/TypeScript setup;
   preserve incumbent hooks and release behavior until their explicit cutovers.
2. Add lint, complete coverage inventory, audit, fixtures and tarball/browser
   consumers. Replace `scripts/verify-repo.sh` logic with tested helpers; keep
   `npm run verify:repo` only as a thin compatibility delegate if retained.
3. Cut over version/badge synchronization and `.githooks` together, removing
   Husky/lint-staged authority. Align CI with `make verify`; relocate Carranca
   inputs and remove local defaults in the same change as its workflow update.
4. Switch publishing to the owner-triggered, verified-tarball path. Update README
   commands, evidence-backed badges, support matrix and release instructions.
   Archive this spec only after the definition of done holds.

Each new element README explains why it exists, how to use it and how to replace
it. `AGENTS.md` states the coverage floor, command authority, approval workflow,
no-history-write rule and requirement for confirmation before destructive
operations. Guidance is not claimed to be runtime enforcement. Stop and report
blockers rather than weaken gates; record necessary deviations as new decisions
in the implementation PR.

## Definition of done

- [ ] Only the adoption spec changes before approval; no implementation or release
      is authorized by drafting it.
- [ ] Fresh-checkout local `make verify` succeeds without host Node/npm; actual
      GitHub Actions results prove the same gates for the implementation revision.
- [ ] All production source and helper files are accounted for, with 100% in all
      four coverage metrics; an added untested file makes verification fail.
- [ ] Installed-tarball CJS, ESM interoperability, declaration, Node 18/20/22/24,
      lifecycle and real Chromium consumer checks pass without checkout fallback.
- [ ] Synthetic contract fixtures and executable examples cover the preserved
      data/migration/export behavior; missing fixtures and deliberate contract drift
      cause failure. No new schema or service contract is introduced.
- [ ] Version/lockfile/badge drift, invalid changelog changes, audit/report
      failures, expired exceptions, missing browsers and failing child commands are
      demonstrated to fail non-zero. Verification leaves tracked files unchanged.
- [ ] Hook installation/conflict and partial-staging tests pass; hooks do not
      stage files. Husky/lint-staged no longer provide a second hook authority.
- [ ] Carranca CI review has a successful trusted smoke run or equivalent tested
      invocation evidence. Default local binding is gone; no new sandbox exists.
      Failed/incomplete reviewer runs are distinguishable from successful reviews.
- [ ] A credential-free release rehearsal verifies the exact tarball and proves
      push-to-main alone cannot publish. Owner triggering and credential boundaries
      are documented; no publication is needed for acceptance.
- [ ] Existing changelog history, MIT licensing, package/subpath identity,
      runtime-dependency count and package/schema version separation are preserved.
- [ ] New documentation and configuration use project-owned names, contain no
      inherited organization identifiers or workstation source paths, and require
      no sibling repository. No reference service, contract generator, stack driver
      or agent-login teardown is applicable because none is imported.

## Decisions

1. **D1. Existing-repository intent.** Strengthen `canto-data` in place for
   reproducibility, trustworthy gates and consumer compatibility. No fresh clone
   migration, history reset or changes to other repositories.
2. **D2. Identity and history.** Keep `canto-data`, MIT, zero runtime dependencies,
   public exports and the current changelog grammar/history. No inherited product
   or organization names survive in new machinery; names use `canto-data-*`.
3. **D3. Keep library source.** Retain TypeScript, Jest and the current CommonJS
   distribution. Preserve data semantics and Node `>=18`; do not impose dual
   output solely to imitate the reference library.
4. **D4. Omit hello-world code.** There is no reference service to tear down and
   no reason to add Python, an app factory or health endpoint.
5. **D5. Keep and extend documentation.** README remains the product reference;
   element READMEs document operational authority and replacement costs. No
   separate documentation website is introduced.
6. **D6. Swap the contract element.** Use committed synthetic fixtures against
   existing public validators/migrations/format helpers. This avoids a second
   schema authority, at the cost of maintaining explicit expected outcomes rather
   than an automatically generated OpenAPI contract.
7. **D7. Keep spec-first approval.** Adopt local active/archive specs, approval by
   merge or explicit solo spec-only commit, and stable append-only decisions.
8. **D8. Swap the toolkit.** Use digest-pinned rootless Podman/Node, npm ci and
   Make targets, retaining Jest/Prettier and adding ESLint. Accept container
   startup, cache and image maintenance costs for local/CI reproducibility.
9. **D9. Swap integration.** Test installed tarballs, declarations and real
   browser bundler consumption rather than a live HTTP stack. Accept pinned
   browser/bundler tooling and first-pull cost; no native browser-ESM claim.
10. **D10. Replace hooks.** Use one opt-in `.githooks` set, fail-fast Make-backed
    checks and explicit, non-staging sync commands. Retire Husky/lint-staged at
    cutover; fresh CI is the bypass-resistant backstop.
11. **D11. Omit application containers.** No service images, pod driver, deployed
    stack or service-image scanner. Development containers remain in scope.
12. **D12. Carranca is CI-only.** Keep its CI review integration, remove default
    local bindings, and add no new sandbox. Necessary inputs become CI-scoped;
    model credentials and the separate reviewer environment stay confined there.
13. **D13. Swap agent glue.** Use portable `AGENTS.md`, not a mandatory default
    agent or copied harness configuration. Agents do not own history or releases;
    documentation alone is not asserted to enforce that boundary.
14. **D14. Coverage is absolute.** Keep 100% statements, branches, functions and
    lines and expand inventory to the public barrel and executable helpers.
    Synchronize this policy across test configuration and guidance.
15. **D15. Continue version authority.** Keep the changelog as the authored package
    version, synchronize both lockfile fields and README, and preserve separate
    schema/manifest versions. Keep badges only with machine-checked evidence.
16. **D16. Use existing CI.** GitHub Actions runs the same full toolkit gate and
    supported-runtime consumers. Carranca remains advisory, not gate authority.
17. **D17. Owner-trigger releases.** Replace automatic publishing with an explicit
    trusted release action and publish only its verified tarball. Tags remain
    owner-controlled; agents never publish.
18. **D18. Fail closed on dependencies.** Audit all locked dependencies at
    HIGH/CRITICAL severity with reviewed, expiring exceptions. No silent offline
    pass; OS-image vulnerability scanning is not included in this adoption.
19. **D19. Ordered replacement.** Adopt in the R6 sequence with one authority per
    concern. No implementation begins in this spec-only task; acceptance requires
    actual verification evidence, not copied claims from the reference project.
20. **D20. Tracker.** No external ticket; the spec review/merge is the intent and
    approval record.
21. **D21. Toolkit-owned verification tooling.** Group verification tooling under
    one `toolkit/` directory: the container at `toolkit/Containerfile`, the Make
    include fragments at `toolkit/mk/*.mk`, the executable helpers at
    `toolkit/tools/**` and the synthetic fixtures at `toolkit/fixtures/**`.
    Element documentation stays in `docs/elements/` and root configuration
    (Makefile, Jest, ESLint, tsconfig) stays at the root. Authority is
    unchanged; this decision changes layout only and supersedes the paths
    implied by D6 and D8.
22. **D22. Owner-run release script.** Replace the GitHub Actions release
    workflow with a root `release.sh`. `--check` (the default) verifies the
    tagged `main` revision, runs the full gate and proves the staged tarball
    matches a fresh pack without touching the registry; `--publish` repeats
    those checks and adds an interactive npm login plus a typed confirmation
    because npm now requires a second factor for every publish. Tags stay
    owner-created, no workflow holds publish credentials, the staged artifact
    lives in the gitignored `.release/`, and provenance is not claimed for
    owner-run publishes.
23. **D23. Tag on main, publish never.** A tag-only workflow
    (`.github/workflows/release-tag.yml`) creates `v<version>` once when the
    version reaches `main`, and only after the repository's own version check
    passes; it never moves an existing tag and never publishes. This
    supersedes D22's manual-tagging clause; the owner-run `release.sh` still
    refuses to publish unless the tag identifies the checkout.
24. **D27. README summarises; the docs site is the product reference.**
    `README.md` keeps the badges, a short description, install, a two-snippet
    quick start, the documentation index and the license, and points at the
    published site for everything else. The site pages carry the data model,
    export format, storage, relationship, development and release content, so
    the README no longer duplicates them. This supersedes D5's "README remains
    the product reference" and D26's page list grows to ten pages.
25. **D26. Publish a Starlight docs site to GitHub Pages.** Add an Astro +
    Starlight project under `docs/page/` with authored pages for getting
    started, usage, export format, schema versions and the API. `make
docs-build` builds it inside the pinned toolkit and verifies the expected
    routes, the package version marker, local-only runtime assets and every
    internal link; `.github/workflows/pages.yml` deploys exactly the verified
    `docs/page/dist` through the official Pages actions. The site is not part
    of the published package and carries no second version authority.
26. **D25. Incorporate the upstream 1.1.0/1.2.0 line.** `main` advanced with
    two releases while this implementation was in progress, so the authored
    package version is `1.2.0` and the journal/export schema is `0.19.0` with
    the chunked attachment-content descriptor, its validators and the two
    no-op migrations (`0.17.0 → 0.18.0`, `0.18.0 → 0.19.0`). This supersedes
    the earlier `0.17.0` schema-preservation requirement and the fixed
    fixture count; the contract fixtures were extended to 44 cases covering
    the new public operations and the descriptor rewrite behavior.
27. **D24. Remove the Carranca reviewer.** Delete `.github/carranca/` and
    `.github/workflows/pr-review.yml`. CI is limited to the deterministic gate
    and the tag-only helper; no AI reviewer runs in this repository and no
    reviewer credentials exist. This supersedes D12 (Carranca is CI-only) and
    the reviewer clauses of D16, and removes the reviewer from the file plan;
    the earlier entries stay in this record as history.

## Tracker

none
