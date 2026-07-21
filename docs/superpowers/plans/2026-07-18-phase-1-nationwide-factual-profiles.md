# Phase 1 Nationwide Factual Profiles Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Recommended path:
> dispatch a fresh subagent per task, review each result with `review-quality`,
> then continue. For complex multi-agent splits, use
> `parallel-feature-development`, `team-composition-patterns`, and
> `team-communication-protocols`. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Replace the private ten-seat prototype with a nationwide, release-pinned factual-profile MVP covering the defined federal seat universe, transparent source coverage, scalable reads, corrections, maps, and privacy-gated address lookup.

**Architecture:** Keep the modular Next.js monolith and immutable PostgreSQL/PostGIS release model. Expand additively through a backward-compatible manifest v2, source-specific staging/quarantine jobs, state-cohort release trains, and direct indexed SQL read projections; never turn the prototype manifest loader into a nationwide bulk loader. Publish complete identity/geography skeletons first, then enrich them in separate immutable releases with explicit missingness.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Zod 4, PostgreSQL 16/PostGIS 3.4 locally, Drizzle ORM/Kit, Vitest, official Census/TIGER/ACS/Congress/Clerk/Senate/FEC/state-election sources, S3-compatible raw-object storage in deployed environments.

---

## Scope and fixed decisions

- The canonical current universe is 541 federal office terms at a declared cutoff: 435 voting House offices, five House delegates, one resident commissioner, and 100 Senate offices. Vacancies remain offices/terms with no active membership.
- DC and territories have `senateRepresentation: "none"`; address resolution may return a House/delegate office without fabricating two Senate seats.
- Rankings, compare, evidence publication, local elections, individual donors, voter data, and demographic filtering remain out of scope.
- Phase 1 election coverage may be explicitly unavailable. Modeled values publish only after a state/year gate has complete source, geometry, allocation, reconciliation, rounding, licensing, and coverage evidence.
- Live shared address lookup stays disabled until every item in `docs/deployment/address-lookup-privacy-gate.md` has environment-specific evidence and approval.
- Existing schema v1 releases remain readable and rollback-compatible. Do not edit `drizzle/0000_phase_1.sql`; all changes use additive migrations.
- The workspace is not currently a Git repository. Before execution, ask whether to initialize Git. Commit steps below are conditional on Git being initialized.

## Deployment and data-release train

1. **D1 — Compatibility deployment:** manifest v1/v2 readers, version-aware validation/promotion, direct SQL reads, nationwide schemas, and coverage DTOs deploy while the existing v1 release remains published.
2. **R1 — Nationwide identity/geography skeleton:** after D1 is live, publish all 541 office terms, current memberships, all state/territory geographies, House CD119 boundaries, and explicit per-domain coverage records.
3. **D2 — Enrichment deployment:** source adapters and profile sections deploy against both R1 and later enriched releases.
4. **R2 — Core factual enrichment:** clone R1 into a candidate, then add member biography/committee facts, selected ACS indicators, and FEC aggregates without losing prior content.
5. **R3 — Election context:** clone R2, then add certified original-boundary congressional/presidential records and reviewed state-cohort current-boundary derivations; publish explicit unavailable decisions elsewhere.
6. **D3/R4 — Public product readiness:** release-addressed maps, corrections, privacy-approved address route, operations, accessibility, and launch audit.

Code deployments and immutable data publications are separate events. No v2 release may publish before D1. Each promoted data release must have complete identity/geography coverage and explicit coverage records for absent observations.

## File structure

### Domain and persistence

- Modify `src/domain/contracts.ts` — schema-version union, jurisdiction/Senate eligibility, metric definitions, nationwide catalog manifest.
- Modify `src/domain/validate-manifest.ts` — version-dispatched validation and nationwide universe invariants.
- Create `src/domain/manifest.ts` — shared `ReleaseManifest` v1/v2 parsing and checksum dispatch.
- Create `drizzle/0001_phase_1_nationwide.sql` — immutable additive v2 foundation containing every Phase 1 publishable table, source-specific staging table, coverage record, content-digest registry, and public-query index.
- Create `drizzle/0002_corrections.sql` — operational correction intake added only with Task 11.
- Modify `src/db/schema.ts` — declarative parity for migration-supported structures.
- Create `src/db/ingestion.ts` — ingestion runs, staging lifecycle, quarantine accounting, and bulk-load transaction helpers.
- Create `src/db/catalog-release.ts` — nationwide release assembly, complete-candidate baselining, content digest, and validation; keep `src/db/manifest.ts` as the v1 compatibility path.
- Modify `src/db/releases.ts` — version-aware publication and content-hash-bound validation.

### Source ingestion

- Create `src/ingestion/core/types.ts` — source adapter/result contracts.
- Create `src/ingestion/core/raw-object-store.ts` — checksum-first local/S3 object interface.
- Create `src/ingestion/core/run-source.ts` — bounded streaming extract/stage/validate/load orchestration.
- Create `src/ingestion/identity/` — House/Senate/Bioguide/Congress adapters.
- Create `src/ingestion/tiger/` — national CD119/state geometry compiler.
- Create `src/ingestion/acs/` — indicator dictionary and 5-year observation importer.
- Create `src/ingestion/fec/` — candidate/committee/report summary importer and aggregate projection.
- Create `src/ingestion/elections/` — state/year decision gates and certified/modeled result importers.
- Create `scripts/ingest.ts` — CLI entry point with source, release, cutoff, and dry-run arguments.

### Read/product paths

- Modify `src/domain/repository.ts` — cursor page and coverage-aware list/profile DTOs.
- Rewrite `src/repositories/postgres.ts` — direct SQL projections.
- Retain `src/repositories/in-memory.ts` only for v1/offline tests.
- Create `src/repositories/sql/` — browse, profile, source, map, and release queries.
- Modify `src/ui/server-data.ts` and `src/ui/view-models.ts` — pagination, coverage, nationwide states.
- Modify `src/app/page.tsx` and `src/app/seats/[id]/page.tsx` — paginated browse and nationwide profile sections.
- Create `src/app/api/address/resolve/route.ts` disabled by default; only activate public `enabled` mode after the privacy gate passes.
- Create `src/app/api/corrections/route.ts` and `src/app/corrections/page.tsx`.
- Create `src/app/maps/[releaseId]/[geographyId]/route.ts` and `src/components/seat-map.tsx`.

### Tests and operations

- Extend `src/db/integration.test.ts` for v1 rollback, v2 promotion, complete-candidate cloning, large catalogs, SQL plans, and corrections.
- Create `src/test/fixtures/nationwide-skeleton.ts` — generated 541-office test skeleton with synthetic geometry only.
- Create source adapter contract tests beside every adapter.
- Create `src/repositories/postgres-nationwide.test.ts`.
- Create `src/ingestion/ingestion.integration.test.ts`.
- Create `docs/data/indicator-dictionary.md`, `docs/data/source-coverage.md`, and `docs/operations/release-runbook.md`.

## Task 1: Freeze the Phase 1 compatibility contracts

**Files:**
- Create: `src/domain/manifest.ts`
- Modify: `src/domain/contracts.ts`
- Modify: `src/domain/validate-manifest.ts`
- Test: `src/domain/contracts.test.ts`
- Test: `src/domain/validate-manifest.test.ts`

- [ ] **Step 1: Write failing schema-version and jurisdiction tests**

Add tests proving v1 still accepts exactly 10–12 House profiles, v2 accepts the 541-office universe, DC/territory records require no Senate pair, and all Phase 1 publishable domains participate in v2 identity/checksum validation:

```ts
expect(parseReleaseManifest(coherentManifest()).schemaVersion).toBe(1);
expect(parseReleaseManifest(nationwideSkeleton()).schemaVersion).toBe(2);
expect(validateReleaseManifest(nationwideSkeleton()).success).toBe(true);
expect(validateReleaseManifest(withInventedDcSenators(nationwideSkeleton())).success).toBe(false);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm run test:run -- src/domain/contracts.test.ts src/domain/validate-manifest.test.ts`

Expected: failure because schema version 2 and jurisdiction eligibility do not exist.

- [ ] **Step 3: Add a discriminated manifest union without changing v1**

Create this public shape in `src/domain/manifest.ts`:

```ts
export const jurisdictionRepresentationSchema = z.strictObject({
  jurisdictionCode: usStateCodeSchema,
  houseRepresentation: z.enum(["voting", "delegate", "resident_commissioner"]),
  senateRepresentation: z.enum(["two_seats", "none"]),
});

export const nationwideManifestSchema = prototypeManifestSchema.omit({
  schemaVersion: true,
  profileSeatCycleIds: true,
}).extend({
  schemaVersion: z.literal(2),
  catalogSeatCycleIds: z.array(seatCycleIdSchema).min(1),
  jurisdictions: z.array(jurisdictionRepresentationSchema).min(1),
  coverageRecords: z.array(coverageRecordSchema),
  biographicalFacts: z.array(personBiographicalFactSchema),
  committeeAssignments: z.array(committeeAssignmentSchema),
  acsVariables: z.array(acsVariableSchema),
  financeAggregates: z.array(financeAggregateSchema),
  fundingCategoryAggregates: z.array(fundingCategoryAggregateSchema),
  outsideSpendingAggregates: z.array(outsideSpendingAggregateSchema),
  electionDecisions: z.array(electionDecisionSchema),
  mapArtifacts: z.array(mapArtifactSchema),
  snapshotDerivations: z.array(snapshotDerivationSchema),
}).strict();

export const releaseManifestSchema = z.discriminatedUnion("schemaVersion", [
  prototypeManifestSchema,
  nationwideManifestSchema,
]);
```

Keep checksum dispatch explicit: v1 uses the existing canonical serializer; v2 uses `catalogSeatCycleIds` order and includes jurisdictions, coverage, member facts, committee assignments, ACS definitions/observations, FEC filings/aggregates/inputs, election decisions/contests/results, map artifacts, snapshot derivations, and every provenance edge. Add a test that mutating one row in each publishable collection changes the v2 checksum.

- [ ] **Step 4: Add v2 universe validation**

Enforce unique catalog IDs, exact office/term closure, jurisdiction eligibility, active membership cardinality, 441 House and 100 Senate office terms at cutoff, and no Senate requirement for `senateRepresentation: "none"`. Freeze a coverage-domain dictionary (`identity`, `geography`, `member`, `acs`, `finance`, `election_2020`, `election_2022`, `election_2024`, `maps`) so R1 can state `complete`, `partial`, `not_collected`, or `unavailable` without fabricated observations. Keep the count in a named release-universe policy object so tests can introduce future Congress-specific policies without weakening the current release.

- [ ] **Step 5: Run focused and full domain tests**

Run: `npm run test:run -- src/domain`

Expected: all domain tests pass; v1 checksum fixtures remain unchanged.

- [ ] **Step 6: Commit compatibility contracts**

```bash
git add src/domain src/test/fixtures/nationwide-skeleton.ts
git commit -m "feat: add nationwide manifest v2 contracts"
```

## Task 2: Add additive nationwide persistence and ingestion metadata

**Files:**
- Create: `drizzle/0001_phase_1_nationwide.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0001_snapshot.json`
- Modify: `src/db/schema.ts`
- Create: `src/db/ingestion.ts`
- Create: `src/db/catalog-release.ts`
- Modify: `src/db/releases.ts`
- Test: `src/db/schema.test.ts`
- Test: `src/db/integration.test.ts`

- [ ] **Step 1: Write migration assertions first**

Assert that migration `0001` exists, does not modify v1 DDL, removes the position-12 restriction additively, and creates every v2 publishable structure up front: jurisdictions, coverage records, biography facts, committee assignments, ACS variables, finance aggregates/inputs, funding-category aggregates, outside-spending aggregates, election decisions, map artifacts, snapshot derivations, content-domain digests, and source-specific staging/quarantine/run tables. `correction_requests` is excluded because it is mutable operational data owned by migration `0002` in Task 11.

- [ ] **Step 2: Run schema tests and confirm failure**

Run: `npm run test:run -- src/db/schema.test.ts`

Expected: failure because migration `0001` does not exist.

- [ ] **Step 3: Create the additive migration**

Use these minimum integrity constraints:

```sql
ALTER TABLE release_profile_seats DROP CONSTRAINT release_profile_seats_position_ck;
ALTER TABLE release_profile_seats ADD CONSTRAINT release_catalog_position_positive CHECK (position >= 1);

ALTER TABLE release_manifests DROP CONSTRAINT release_manifests_schema_version_ck;
ALTER TABLE release_manifests ADD CONSTRAINT release_manifests_schema_version_ck CHECK (schema_version IN (1, 2));

ALTER TABLE acs_observations DROP CONSTRAINT acs_observations_unit_check;
ALTER TABLE acs_observations ADD CONSTRAINT acs_observations_unit_ck CHECK (unit IN ('count','percent','usd','years'));

CREATE TABLE jurisdictions (
  release_id text NOT NULL,
  jurisdiction_code text NOT NULL,
  house_representation text NOT NULL,
  senate_representation text NOT NULL,
  PRIMARY KEY (release_id, jurisdiction_code),
  FOREIGN KEY (release_id) REFERENCES data_releases(id),
  CHECK (senate_representation IN ('two_seats', 'none'))
);

CREATE TABLE ingest_runs (
  id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES data_releases(id),
  source_id text NOT NULL,
  adapter_version text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','validated','failed','loaded')),
  extracted_count integer NOT NULL DEFAULT 0 CHECK (extracted_count >= 0),
  staged_count integer NOT NULL DEFAULT 0 CHECK (staged_count >= 0),
  quarantined_count integer NOT NULL DEFAULT 0 CHECK (quarantined_count >= 0)
);

CREATE TABLE release_content_digests (
  release_id text NOT NULL REFERENCES data_releases(id),
  domain text NOT NULL,
  row_count bigint NOT NULL CHECK (row_count >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  validated_at timestamptz NOT NULL,
  PRIMARY KEY (release_id, domain)
);
```

Use source-specific staging tables (`stg_identity`, `stg_tiger`, `stg_acs`, `stg_fec`, and `stg_elections`) rather than one generic JSON fact table. `quarantined_records` contains run ID, source natural key, snapshot ID, payload checksum, parser error code, and a redacted diagnostic; it contains no raw address or individual-contributor fields. Add all public-query indexes now so migration `0001` is never rewritten later.

Attach the existing candidate-only mutation guard pattern to every new release-scoped table. Every insert/update/delete must lock and verify a candidate release, invalidate the affected domain digest, and reject all `release_id` moves. Add integration tests proving every new table is immutable in published and retired releases.

Migration assertions must prove v1 and v2 manifest rows persist, v3 is rejected, and an ACS observation with unit `years` round-trips while unknown units fail.

- [ ] **Step 4: Implement ingestion-run state transitions**

Expose `startIngestRun`, `recordStageBatch`, `recordQuarantineBatch`, `markValidated`, and `markLoaded`. Reject illegal transitions and row-count mismatches in SQL and TypeScript. Add `baselineCandidateRelease(sourceReleaseId, candidateRelease)` that copies every registered release-scoped content table, geometry, provenance edge, catalog position, and domain digest into a candidate transaction, then recomputes and compares all digests before allowing enrichment.

- [ ] **Step 5: Make validation and publication version-aware**

Dispatch v1 to the existing manifest loader/validator and v2 to `catalog-release.ts`. Candidate writes invalidate affected domain digests. Expensive v2 validation runs before publication and stores content-bound digests; the short publication transaction locks the candidate, rechecks every registered digest and gate, and only then changes the active pointer.

- [ ] **Step 6: Verify migration, v1 rollback, and candidate baselining without publishing v2**

Recreate `dsa_seats_test`, apply `0000` then `0001`, seed/promote a v1 release, baseline a v2 candidate, mutate one copied row to prove digest invalidation, and discard it. Do not publish v2 until Task 5 deploys v2-compatible direct reads.

Run: `TEST_DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_test npm run test:integration`

Expected: v1 remains published/readable; the v2 candidate validates only when complete; rollback behavior is unchanged; Drizzle journal/snapshot contain immutable `0000` and `0001` entries.

- [ ] **Step 7: Commit additive persistence**

```bash
git add drizzle src/db
git commit -m "feat: add nationwide ingestion persistence"
```

## Task 3: Build the ingestion kernel and raw-object boundary

**Files:**
- Create: `src/ingestion/core/types.ts`
- Create: `src/ingestion/core/raw-object-store.ts`
- Create: `src/ingestion/core/run-source.ts`
- Create: `src/ingestion/core/run-source.test.ts`
- Create: `scripts/ingest.ts`
- Modify: `package.json`

- [ ] **Step 1: Write adapter contract tests**

Test successful extraction, checksum mismatch, duplicate source key, parse quarantine, validation failure, dry run, and idempotent rerun.

- [ ] **Step 2: Define the adapter contract**

```ts
export interface SourceAdapter<TRaw, TStage> {
  readonly sourceName: string;
  readonly adapterVersion: string;
  extract(context: ExtractContext): AsyncIterable<RawObject<TRaw>>;
  parse(raw: RawObject<TRaw>): AsyncIterable<ParseResult<TStage>>;
  naturalKey(row: TStage): string;
  stage(client: PoolClient, runId: string, rows: readonly TStage[]): Promise<void>;
  validateStaged(client: PoolClient, runId: string): Promise<readonly ValidationIssue[]>;
  loadFromStage(client: PoolClient, runId: string, releaseId: ReleaseId): Promise<void>;
}
```

`runSource()` flushes parsed records in bounded batches of at most 1,000 rows and never materializes a national file in one array. `RawObjectStore.put()` streams SHA-256 calculation before persistence and returns `{ objectKey, sha256, byteSize }`. The local implementation confines paths with `realpath`; the deployed implementation uses a configured S3-compatible bucket with object versioning.

- [ ] **Step 3: Implement fail-closed orchestration**

`runSource()` must persist the source snapshot and run metadata, quarantine parse failures, stop before load when staged SQL validation fails, and load from source-specific staging tables in a candidate release transaction. A rerun with the same source release/checksum returns the existing successful run instead of duplicating facts. Add a million-row generated stream test that asserts peak buffered rows never exceed the configured batch size.

- [ ] **Step 4: Add the CLI**

Support exact commands:

```bash
npm run ingest -- --source identity --release rel_... --cutoff 2026-07-01 --dry-run
npm run ingest -- --source tiger --release rel_... --cutoff 2026-07-01
```

Reject missing source/release/cutoff, unknown sources, and production writes without `RAW_OBJECT_BUCKET` and `DATABASE_URL`.

Task 3 freezes and tests the CLI parser, environment policy, and injected adapter registry. It must return a finite unavailable-adapter error without opening a pool when a concrete adapter has not shipped; do not add synthetic/no-op production adapters. Task 4 registers the real `identity` and `tiger` adapters after their pinned-source tests pass. ACS, FEC, and election commands remain recognized but unavailable until their corresponding tasks.

- [ ] **Step 5: Run unit tests, typecheck, and lint**

Run: `npm run test:run -- src/ingestion/core && npm run typecheck && npm run lint`

Expected: all pass.

- [ ] **Step 6: Commit ingestion kernel**

```bash
git add src/ingestion scripts/ingest.ts package.json package-lock.json
git commit -m "feat: add source ingestion kernel"
```

## Task 4: Build the nationwide identity and geography candidate

**Files:**
- Create: `src/ingestion/identity/house.ts`
- Create: `src/ingestion/identity/senate.ts`
- Create: `src/ingestion/identity/identity.test.ts`
- Create: `src/ingestion/tiger/national.ts`
- Create: `src/ingestion/tiger/national.test.ts`
- Create: `src/db/catalog-release.ts`
- Create: `scripts/build-national-tiger-artifacts.sh`
- Modify: `data/README.md`

- [ ] **Step 1: Write source-adapter golden tests from pinned official samples**

Cover voting districts, at-large `00 -> AL`, DC delegate, Puerto Rico resident commissioner, a vacancy, appointed senator, two Senate classes, duplicate Bioguide ID, malformed GEOID, and a territory with no Senate representation.

- [ ] **Step 2: Implement deterministic identity parsing**

Use official House Clerk and Senate rosters as current membership authority, Bioguide IDs as stable person identifiers, dated terms/memberships, and no name-based fuzzy merging. Emit reviewable mapping errors for ambiguous/missing external IDs.

Register the tested identity adapter in `scripts/ingest.ts`'s production registry only after this step passes. Register the TIGER adapter after Step 3 passes; before registration, the Task 3 CLI must continue returning its finite unavailable-adapter result.

- [ ] **Step 3: Build nationwide TIGER artifacts hermetically**

Extend the existing defensive artifact pipeline to national CD119 and state/territory geometries. Produce normalized EPSG:4326 MultiPolygon files, bytewise feature ordering, source archive hashes, artifact hashes, feature counts, and state/GEOID closure checks.

- [ ] **Step 4: Load in state cohorts using bulk staging**

Do not call `seedPrototypeManifest`. Stage and bulk-load one jurisdiction cohort at a time, then run whole-release identity/geometry validation. The candidate cannot publish unless all 541 office terms and jurisdiction policies are present.

- [ ] **Step 5: Add explicit R1 coverage records**

Emit `complete` coverage for identity/geography and `not_collected` coverage for member, ACS, finance, maps, election 2020, election 2022, and election 2024. Coverage records are release-level or seat/domain-scoped as defined in Task 1; do not create fake zero-valued observations.

- [ ] **Step 6: Prove candidate behavior without publication**

Integration assertions:

```ts
expect(await countCurrentHouseTerms(releaseId)).toBe(441);
expect(await countCurrentSenateTerms(releaseId)).toBe(100);
expect(await listJurisdictionErrors(releaseId)).toEqual([]);
expect(await activeMembershipCountForVacancy(releaseId, vacantOfficeId)).toBe(0);
```

Verify DC/territory point lookup returns House representation plus an empty Senate list at the internal locator boundary.

Leave the nationwide release in candidate state. The currently deployed v1 application remains pointed at the v1 release until Task 5 is complete.

- [ ] **Step 7: Commit nationwide candidate builder**

```bash
git add src/ingestion/identity src/ingestion/tiger src/db/catalog-release.ts scripts data/README.md
git commit -m "feat: add nationwide identity and geography release"
```

## Task 5: Replace whole-manifest reads with indexed SQL projections

**Files:**
- Modify: `src/domain/repository.ts`
- Rewrite: `src/repositories/postgres.ts`
- Create: `src/repositories/sql/list-seats.ts`
- Create: `src/repositories/sql/get-seat-profile.ts`
- Create: `src/repositories/sql/list-sources.ts`
- Create: `src/repositories/postgres-nationwide.test.ts`
- Create: `docs/reviews/phase-1-r1-release.md`

- [ ] **Step 1: Write pagination and missing-coverage tests**

Cover first/next page, stable cursor under ties, every allowed filter, identity-only search, missing presidential/FEC values last in both directions, delegate records, vacancies, no presidential contest, and no finance summary.

- [ ] **Step 2: Add cursor contracts**

```ts
export const seatPageRequestSchema = seatQuerySchema.extend({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(500).optional(),
}).strict();

export const seatPageSchema = z.strictObject({
  releaseId: releaseIdSchema,
  items: z.array(seatListItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
});
```

Make headline facts coverage-aware; absence becomes an explicit missing reason instead of a projection exception.

- [ ] **Step 3: Implement direct SQL list/profile/source queries**

Use release-scoped CTEs/lateral joins for current membership, presidential summary, and finance aggregate. Apply deterministic ID tie-breaks. Profile source closure is one SQL query over the profile's referenced snapshot IDs, not one manifest hydration.

- [ ] **Step 4: Verify the frozen public-query indexes**

Confirm migration `0001` already contains indexes for `(release_id, cycle_year, id)`, office state/chamber/district, active membership/party lookup, canonical finance sort, presidential metric sort, and normalized identity search. If an index is missing, create a new immutable migration `0002_query_indexes.sql`, update the Drizzle journal/snapshot, and renumber the later correction migration to `0003_corrections.sql`; never edit an applied migration.

- [ ] **Step 5: Capture query plans**

Run `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against 541 seats plus production-shaped synthetic cardinalities of at least 100,000 fact/provenance rows. Do not ban sequential scans categorically; PostgreSQL may choose them correctly. Record plans and assert bounded result rows, no multiplicative join explosion, statement-timeout compliance, and a measured local p95 budget for browse/profile queries.

- [ ] **Step 6: Run parity and integration tests**

Run: `TEST_DATABASE_URL=... npm run test:run -- src/repositories src/db/integration.test.ts`

Expected: exact DTO parity for the shared v1 fixture, a nationwide SQL-specific contract for v2, and zero calls to `loadPrototypeManifest` on v2 route reads.

- [ ] **Step 7: Deploy D1 while v1 remains active**

Build and smoke-test the application against the existing published v1 release. Confirm v1 browse/profile/source/address-internal behavior is unchanged and v2 candidate reads succeed when explicitly release-pinned.

- [ ] **Step 8: Promote and rollback-test R1**

Promote the complete nationwide candidate from Task 4 only after D1 is verified. Smoke-test all jurisdiction classes, then roll back to v1 and re-promote R1 to prove compatibility in both directions.

- [ ] **Step 9: Commit SQL reads and release evidence**

```bash
git add src/domain/repository.ts src/repositories docs/reviews/phase-1-r1-release.md
git commit -m "perf: add nationwide SQL seat projections"
```

## Task 6: Add the member biography and committee fact pipeline

**Files:**
- Create: `src/ingestion/identity/congress.ts`
- Create: `src/ingestion/identity/bioguide.ts`
- Create: `src/ingestion/identity/member-facts.test.ts`
- Modify: `src/ui/view-models.ts`

- [ ] **Step 1: Write contract tests for dated facts**

Cover date of birth, derived age as of release cutoff, tenure from dated memberships, committee assignment term, missing biography, and conflicting source IDs. Do not persist age as a mutable value.

- [ ] **Step 2: Verify the frozen fact models**

Verify Task 1 contracts and migration `0001` contain `person_biographical_facts` and `committee_assignments` with source snapshot and effective dates. Derive age and tenure in the read projection using the release cutoff. Any required contract change creates manifest v3 and a new migration; it cannot rewrite v2 or migration `0001`.

- [ ] **Step 3: Implement Congress.gov/Bioguide adapters**

Preflight `CONGRESS_API_KEY`, then use `https://api.congress.gov/v3/member` plus official Bioguide/House/Senate records. Use Bioguide ID joins only. Quarantine unmatched records, rate-limit requests, retain update timestamps, and never overwrite dated memberships from a weaker source. Every retained response must enter the source lock before loading.

- [ ] **Step 4: Baseline and enrich the R2 candidate**

Clone R1 with `baselineCandidateRelease`, load member facts into the candidate, recompute the `member` domain digest, and change member coverage from `not_collected` to exact complete/partial counts. Do not publish R2 yet.

- [ ] **Step 5: Add profile rendering and explicit coverage**

Show biography/committee facts only when sourced. Missing age or assignment data must display its missing reason and source cutoff.

- [x] **Step 6: Verify and commit**

Run: `npm run test:run -- src/ingestion/identity src/ui && npm run typecheck && npm run lint`

```bash
git add src/ingestion/identity src/ui data/source-lock.json
git commit -m "feat: add sourced member facts"
```

## Task 7: Add the ACS indicator dictionary and nationwide importer

**Files:**
- Create: `src/ingestion/acs/indicator-dictionary.ts`
- Create: `src/ingestion/acs/adapter.ts`
- Create: `src/ingestion/acs/adapter.test.ts`
- Create: `docs/data/indicator-dictionary.md`

- [x] **Step 1: Freeze the bounded public indicator dictionary in tests**

Publish only the three direct 2024 ACS 5-year table-based summary-file indicators already source-locked: total population (`B01003_001E/M`), median age (`B01002_001E/M`), and median household income (`B19013_001E/M`). Each definition contains exact estimate/MOE columns, unit (`count`, `years`, or `usd`), universe, survey period, and published-MOE method. Defer age bands, bachelor's attainment, race/ethnicity, housing tenure, and urbanicity; the current contract/source lock cannot publish those with defensible MOE and geography semantics.

- [x] **Step 2: Verify the frozen ACS contracts**

Verify Task 1 added `years` to the unit enum and Task 2 created `acs_variables`. Do not create derived percentages in Task 7; the generic `delta_method` contract cannot distinguish all Census subset-proportion and multi-cell MOE cases.

- [x] **Step 3: Implement source-locked summary-file extraction and sentinel handling**

Use only the three exact checksum-pinned official table-based summary files recorded in `data/source-lock.json`. Persist each exact raw receipt and a strict envelope containing the full source-lock SHA, exact lock ID, estimate/MOE columns, and sentinel outcomes. Force ACS ingestion into validated-only staging; ordinary per-run loading must fail. Decode known Census sentinel values explicitly, quarantine unknown sentinels, map only expected CD119 House GEOIDs locally, and reject state geometries or mismatched district plans.

- [x] **Step 4: Enforce demographic product restrictions**

Extend repository/UI tests proving every ACS mutation leaves list filtering, ordering, pagination, search, and export behavior unchanged.

- [x] **Step 5: Atomically continue the R2 candidate and verify coverage accounting**

Use one Task-4-style finalizer transaction over the existing R2 member candidate and all three validated ACS runs. Under the same locks, assert the Task 6 invariant, replay exact receipts, compare typed staging, enforce exact 441 House/CD119 closure and explicit non-ACS jurisdiction treatment, replace the ACS placeholder with exactly three definitions and coverage records, write observations/lineage, transition all runs loaded, recompute canonical/content checksums and all seven digests/gate, and leave R2 candidate-only. The query-only restart verifier must replay the same receipts under read-compatible share locks and check Task 6/7 invariants plus the gate in one transaction.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:run -- src/ingestion/acs src/domain src/repositories && npm run data:verify`

```bash
git add src/ingestion/acs docs/data data/source-lock.json
git commit -m "feat: add nationwide ACS indicators"
```

## Task 8: Add FEC summary aggregation across authorized committees

**Files:**
- Create: `src/ingestion/fec/adapter.ts`
- Create: `src/ingestion/fec/amendments.ts`
- Create: `src/ingestion/fec/aggregates.ts`
- Create: `src/ingestion/fec/adapter.test.ts`
- Modify: `src/repositories/sql/get-seat-profile.ts`

- [ ] **Step 1: Write amendment and aggregation tests**

Cover root/amendment chains, branching rejection, superseded filings, multiple authorized committees, transfers, refunds, missing cash, mixed coverage periods, and a candidate with no committee.

- [ ] **Step 2: Verify aggregate contracts**

```ts
export const financeAggregateSchema = z.strictObject({
  id: z.string().min(1),
  releaseId: releaseIdSchema,
  seatCycleId: seatCycleIdSchema,
  asOf: isoDateSchema,
  coverageThrough: isoDateSchema,
  cashOnHand: factValueSchema(z.number().nonnegative()),
  receipts: factValueSchema(z.number().nonnegative()),
  disbursements: factValueSchema(z.number().nonnegative()),
  methodologyVersion: z.string().min(1),
  inputFilingIds: z.array(fecFilingIdSchema).min(1),
});

export const fundingCategoryAggregateSchema = z.strictObject({
  releaseId: releaseIdSchema,
  seatCycleId: seatCycleIdSchema,
  category: z.string().min(1),
  amount: factValueSchema(z.number().nonnegative()),
  coverageThrough: isoDateSchema,
  methodologyVersion: z.string().min(1),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
});

export const outsideSpendingAggregateSchema = z.strictObject({
  releaseId: releaseIdSchema,
  seatCycleId: seatCycleIdSchema,
  supportAmount: factValueSchema(z.number().nonnegative()),
  opposeAmount: factValueSchema(z.number().nonnegative()),
  coverageThrough: isoDateSchema,
  methodologyVersion: z.string().min(1),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
});
```

Verify these Task 1 contracts and Task 2 finance, category, outside-spending, and aggregate-to-filing input tables are present and checksum-covered. Do not treat one filing as the whole seat when several authorized committees are included.

- [ ] **Step 3: Implement safe extraction**

Preflight `FEC_API_KEY`; use `https://api.open.fec.gov/v1/` candidate/committee/report summary endpoints or non-personal F3 summary sections. Do not retain Schedule A contributor details. Persist request hashes and no-retention records when a raw source includes restricted personal data.

- [ ] **Step 4: Publish canonical aggregates and permitted funding context**

Select canonical amendment leaves per committee/reporting scope, align included committee periods, compute aggregates with an explicit method, and emit missing reasons where comparability fails. Add official aggregate outside-spending totals where source attribution reconciles. Add donor categories/organizations only under an approved redistributable license; otherwise publish an explicit licensing-unavailable coverage record rather than contributor-level data.

- [ ] **Step 5: Complete and publish R2**

Load finance facts into the R2 candidate, recompute finance/member/ACS and whole-release digests, run all release gates, deploy D2 code against R1, then promote R2. Roll back to R1 and re-promote R2 before closure.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:run -- src/ingestion/fec src/repositories && npm run typecheck && npm run lint`

```bash
git add src/ingestion/fec src/repositories data/source-lock.json docs/reviews
git commit -m "feat: add aggregate FEC summaries"
```

## Task 9: Add jurisdiction-gated 2020/2022/2024 election context

**Files:**
- Create: `src/ingestion/elections/gate.ts`
- Create: `src/ingestion/elections/certified.ts`
- Create: `src/ingestion/elections/overlay.ts`
- Create: `src/ingestion/elections/reconcile.ts`
- Create: `src/ingestion/elections/elections.test.ts`
- Modify: `data/metadata/election-result-feasibility-2020-2024.json`
- Modify: `src/offline/feasibility-matrix.ts`

- [x] **Step 1: Write gate-transition tests**

A jurisdiction/year is approved only when every required source authority, license, reporting-unit geometry, non-geographic treatment, allocation, reconciliation, rounding, and coverage gate passes. Scan gates in dependency order: if the first non-passed gate is unassessed, it and every later gate are unassessed; if it fails, the decision is unavailable and later gates may fail or remain unassessed, but never pass. Do not fabricate downstream failures. 2020/2024 close over the 50 states and DC; 2022 closes over those jurisdictions plus AS/GU/MP/PR/VI. Test that an official landing page alone cannot upgrade the row.

- [x] **Step 2: Add persisted decision records**

Baseline R2 into an R3 candidate. Each election import or unavailable record references a versioned state/year decision snapshot containing original publisher, intermediary, certification status, geometry release, non-geographic vote policy, allocation method, reconciliation delta, rounding, and expected/actual coverage.

- [ ] **Step 3: Import certified original-boundary results and recent congressional contests first**

Use checksum-pinned Clerk election-statistics publications plus original state authorities. Import 2020 and 2024 presidential records and the most recent 2020/2022/2024 House/Senate general contests available for each office; keep results attached to their election-time geography. Reconcile candidate totals and denominators to authority totals; quarantine unresolved discrepancies.

- [x] **Step 4: Implement overlays only for reviewed cohorts**

The minimum R3 cohort is the four prototype jurisdictions: Alaska, Alabama, Arizona, and Florida for both 2020 and 2024. Alaska may use direct statewide-at-large totals. AL/AZ/FL remain unavailable unless every gate passes. Use reporting-unit geometry and documented split weights. Never substitute Census VTDs without a proven election-unit crosswalk. A current-boundary metric must preserve every input snapshot and quality field.

- [x] **Step 5: Emit explicit unavailable facts elsewhere**

Generate `unavailable—not defensibly modeled` records from the state/year gate, not from absence of rows. Sanders 2020 remains absent unless a separate primary/caucus-specific gate passes.

- [ ] **Step 6: Complete nationwide decisions and publish R3**

Every state/DC cycle must have a reviewed decision record even when its result remains unavailable. Recompute election and whole-release digests, update exact coverage counts, deploy election-capable D2 code against R2, promote R3, and prove rollback/re-promotion.

- [ ] **Step 7: Verify and commit one state cohort at a time**

Run per cohort: source lock, subtotal/total reconciliation, geometry match, allocation coverage, deterministic rerun, and profile rendering tests.

```bash
git add src/ingestion/elections src/offline data/metadata data/source-lock.json
git commit -m "feat: add reviewed election result cohort"
```

Repeat the commit per independently reviewed state cohort; do not combine unrelated states in one unreviewable import.

## Task 10: Add release-addressed maps

**Files:**
- Create: `src/ingestion/tiger/simplify.ts`
- Create: `src/ingestion/tiger/simplify.test.ts`
- Create: `src/app/maps/[releaseId]/[geographyId]/route.ts`
- Create: `src/components/seat-map.tsx`
- Modify: `src/app/seats/[id]/page.tsx`

- [ ] **Step 1: Write geometry-output tests**

Assert source artifact hash linkage, valid MultiPolygon output, bounded simplification error, stable bytes, release-addressed cache key, and rejection of unknown release/geography IDs.

- [ ] **Step 2: Generate simplified GeoJSON artifacts offline**

Baseline R3 into an R4 candidate. Do not simplify on request. Store the original TIGER geometry in PostGIS and load source-linked simplified artifact metadata under `maps/{releaseId}/{geographyId}.geojson` into the candidate.

- [ ] **Step 3: Add the map route**

Return only published-release artifacts with immutable cache headers. Reject candidate releases and path traversal. The map response contains district geometry only, never lookup coordinates.

- [ ] **Step 4: Delegate visual map integration to `@designer`**

Add an accessible static fallback, text district label, keyboard-safe controls if interactive, and no third-party map telemetry.

- [ ] **Step 5: Validate, deploy D3, and publish R4**

Recompute map and whole-release digests, update map coverage counts, and validate exact artifact closure. Deploy map-capable D3 code while R3 remains active, promote R4, smoke-test published R4 map URLs immediately, then prove rollback/re-promotion. Candidate map URLs remain inaccessible publicly.

- [ ] **Step 6: Verify and commit**

Run map unit tests, browser desktop/mobile checks, accessibility smoke tests, and source-lock verification.

```bash
git add src/ingestion/tiger src/app/maps src/components src/app/seats
git commit -m "feat: add release-addressed district maps"
```

## Task 11: Add correction intake without mutating releases

**Files:**
- Create: `src/domain/corrections.ts`
- Create: `src/app/api/corrections/route.ts`
- Create: `src/app/corrections/page.tsx`
- Create: `src/app/corrections/actions.ts`
- Create: `src/domain/corrections.test.ts`
- Create: `drizzle/0002_corrections.sql` (or the next unused immutable migration number if Task 5 required a query-index migration)
- Modify: `drizzle/meta/_journal.json`
- Create: the matching Drizzle schema snapshot

- [ ] **Step 1: Write abuse and lifecycle tests**

Cover invalid release/seat references, oversized text, URL injection, duplicate submission token, rate limit, CSRF/origin failure, accepted submission, rejection, and conversion into a later candidate-release work item. Confirm submissions cannot update published facts.

- [ ] **Step 2: Add a minimal correction contract**

```ts
export const correctionSubmissionSchema = z.strictObject({
  releaseId: releaseIdSchema,
  seatCycleId: seatCycleIdSchema.optional(),
  fieldPath: z.string().min(1).max(200),
  explanation: z.string().min(20).max(4000),
  sourceUrl: z.url().max(2000).optional(),
});
```

Store operational metadata separately from immutable release facts. Do not request political affiliation, voter status, address, or demographic traits.

Generate the correction migration once, apply it to a clean database, and never edit it after application. Correction rows are operational records and do not enter release content digests; only an accepted correction incorporated by a later source/release build changes immutable facts.

- [ ] **Step 3: Implement protected intake**

Require same-origin POST, CSRF token, bounded body, no-store response, distributed rate limit, spam-resistant anonymous identifier with documented TTL, and sanitized errors.

- [ ] **Step 4: Add accessible UI**

Link profiles to a correction form prefilled only with release and seat identifiers. Explain review/version behavior and avoid promising acceptance.

- [ ] **Step 5: Verify and commit**

Run contract, route, browser, accessibility, and database immutability tests.

```bash
git add src/domain/corrections.ts src/app/api/corrections src/app/corrections drizzle
git commit -m "feat: add correction intake"
```

## Task 12: Enable address lookup only after the deployment privacy gate

**Files:**
- Modify: `src/domain/address.ts`
- Modify: `src/address/postgres-resolver.ts`
- Create: `src/app/api/address/resolve/route.ts`
- Modify: `src/app/lookup/page.tsx`
- Create: `src/app/lookup/address-form.tsx`
- Create: `data/metadata/address-resolution-corpus-v2.json`
- Modify: `data/source-lock.json`
- Modify: `docs/deployment/address-lookup-privacy-gate.md`

- [x] **Step 1: Generalize territory output contracts**

Replace the mandatory two-element Senate tuple with a jurisdiction-policy-constrained list: exactly two ordered classes for `two_seats`, exactly zero for `none`. Preserve strict no-coordinate/no-address output schemas.

- [x] **Step 2: Bound pool acquisition**

Add an abort-aware acquisition deadline before any DB work. Keep existing statement timeout and ownership-safe backend cancellation. Test pool exhaustion plus caller abort without leaked work.

- [x] **Step 3: Version the nationwide decision corpus**

Create source-locked corpus v2 rather than rewriting v1. Retain all existing ordinary/boundary/ambiguity/failure cases and add DC, Puerto Rico, Guam, U.S. Virgin Islands, American Samoa, and Northern Mariana Islands. Territory successes expect House/delegate representation and zero Senate seats; unsupported is reserved for geography genuinely absent from the published release. Run the same resolver contract against v1 and v2 releases to prove version-specific behavior.

- [x] **Step 4: Write route privacy tests before route implementation**

Assert POST-only, body-only input, `Cache-Control: no-store`, bounded body, finite response codes, signal propagation, disabled-by-default startup, no redirect, no response coordinates/address echo, and kill-switch behavior.

- [x] **Step 5: Implement a disabled-by-default route and controlled canary mode**

Use an explicit startup-validated mode:

```ts
const addressLookupModeSchema = z.enum(["disabled", "canary", "enabled"]);
const addressLookupMode = addressLookupModeSchema.parse(process.env.ADDRESS_LOOKUP_MODE ?? "disabled");
```

`disabled` always returns the finite disabled result without reading the body. `canary` accepts only a security/operations-approved signed canary request and non-personal corpus vector; ordinary public requests remain disabled. `enabled` is unavailable until final approval. Delegate the complete form and status presentation to `@designer` now, but render the existing informational disabled state unless mode is enabled. The form never stores input client-side beyond the active submission and loads no analytics/session replay. Deploy this complete implementation with `disabled` mode first.

- [x] **Step 6: Commit the disabled-by-default artifact**

```bash
git add src/address src/domain/address.ts src/app/api/address src/app/lookup data/metadata/address-resolution-corpus-v2.json data/source-lock.json
git commit -m "feat: add disabled nationwide address route"
```

This commit pins the exact implementation that will be audited and canary-tested; it does not enable public lookup.

- [ ] **Step 7: Complete configuration audit and pre-approve the canary**

Attach actual proxy/CDN/WAF/APM/error/analytics/Postgres telemetry configuration, Census disclosure review, rate-limit identifier TTL, retention/backup evidence, and two-person authorization for a time-bounded canary window to the deployment checklist. If any pre-canary evidence is absent, leave mode disabled.

- [ ] **Step 8: Run the controlled canary and return to disabled mode**

Temporarily set `canary`, submit only the unique non-residential marker from the approved corpus with its signed canary authorization, exercise success/error/abort paths, search every required telemetry and retention surface, then immediately restore `disabled`. Record results and repeat searches after retention/backup expiry as required by the checklist.

- [ ] **Step 9: Approve enablement and run final public smoke tests**

Security and operations owners approve only after the canary passes. Set `enabled` without changing the audited artifact, then run final browser, privacy-header, accessibility, and kill-switch smoke tests. Any failed control returns the deployment to `disabled`.

- [ ] **Step 10: Commit approval evidence after final gate approval**

```bash
git add docs/deployment/address-lookup-privacy-gate.md
git commit -m "docs: approve privacy-gated address lookup"
```

## Task 13: Update nationwide UI, coverage, and methodology

**Files:**
- Modify: `src/ui/server-data.ts`
- Modify: `src/ui/view-models.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/seats/[id]/page.tsx`
- Modify: `src/app/sources/page.tsx`
- Modify: `src/app/methodology/page.tsx`
- Test: `src/ui/view-models.test.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/nationwide-mvp.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Write nationwide view-model tests**

Cover pagination, delegates, resident commissioner, territories without Senate, vacancies, source coverage, certified/modeled/unavailable election labels, multiple finance inputs, ACS units/MOEs, maps, and correction links. Retain demographic-query rejection tests.

- [x] **Step 2: Compile bounded route models**

Each route performs a bounded number of repository calls. `/sources` uses release-level grouped source/coverage queries instead of loading every profile. Every displayed value carries source cutoff, geography/methodology status, and missingness.

- [x] **Step 3: Delegate responsive nationwide UI changes to `@designer`**

Preserve the approved editorial data-desk design. Add pagination and coverage displays without introducing rank-like ordering, generic dashboards, or demographic controls.

- [x] **Step 4: Install and configure durable browser/accessibility checks**

Install `@playwright/test` and `@axe-core/playwright`; add `test:e2e` and `test:a11y` scripts. The Playwright suite starts the app on a configured free port and tests Chromium at 390px and desktop widths. Test keyboard navigation, screen-reader labels, focus, contrast, table alternatives, empty pages, error states, and zero console/network failures. Run axe against browse, profile, sources, methodology, corrections, maps, and approved lookup states.

- [x] **Step 5: Commit UI changes**

```bash
git add src/ui src/app src/components tests/e2e playwright.config.ts package.json package-lock.json
git commit -m "feat: add nationwide factual profile UI"
```

## Task 14: Add release operations and observability

**Files:**
- Create: `docs/operations/release-runbook.md`
- Create: `docs/data/source-coverage.md`
- Create: `src/operations/release-health.ts`
- Create: `src/operations/release-health.test.ts`
- Modify: `src/db/releases.ts`

- [ ] **Step 1: Define release gates as executable checks**

Require exact universe coverage, geometry validity, source/quarantine counts, ACS/FEC/election coverage reports, provenance closure, public-query smoke tests, and no unresolved blocking review issues.

- [ ] **Step 2: Audit the bounded publication transaction**

Verify Task 2 runs expensive candidate validation before promotion, persists results bound to every release content/geometry digest, rechecks hashes and gate status under the existing release lock, and keeps the pointer transition short. Add concurrency regressions for writes to each new v2 domain and prove each invalidates the stored gate.

- [ ] **Step 3: Emit non-sensitive operational signals**

Record ingestion duration/counts, quarantine reasons, release validation state, promotion/rollback result, query latency, and address status counts. Never log addresses, coordinates, contributor identities, correction text, or database bind values.

- [ ] **Step 4: Write the runbook**

Document candidate creation, source jobs, state-cohort retries, quarantine review, validation, preview, promotion, rollback, canary checks, incident disablement, and data-retention responsibilities with exact commands.

- [ ] **Step 5: Run a rollback drill**

Promote R1, enrich to R2/R3, force a failed candidate, confirm readers remain on the prior release, promote the valid candidate, then roll back while preserving source and audit history.

- [ ] **Step 6: Commit operations**

```bash
git add docs/operations docs/data src/operations src/db/releases.ts
git commit -m "ops: add nationwide release gates and runbook"
```

## Task 15: Final public-MVP acceptance gate

**Files:**
- Modify: `PRD.md` only if accepted scope changes are approved
- Modify: `ARCHITECTURE.md` for implemented operational choices
- Create: `docs/reviews/phase-1-acceptance.md`

- [ ] **Step 1: Recreate the database from zero**

Run:

```bash
docker compose down -v
docker compose up -d --wait
docker compose exec -T postgres psql -U dsa_seats -d postgres -c "CREATE DATABASE dsa_seats_test OWNER dsa_seats;"
DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_test npm run db:migrate
```

Then ingest the nationwide identity/geometry skeleton, run selected enrichment jobs, validate, promote, query, and roll back.

- [ ] **Step 2: Verify the defined universe**

Assert 541 current office terms with separately reported voting House, delegates/resident commissioner, Senate classes, vacancies, specials, and cutoff. Observation coverage is reported independently and never used to hide identity gaps.

- [ ] **Step 3: Run the complete technical gate**

```bash
npm run data:verify
npm run lint
npm run typecheck
TEST_DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_test npm run test:run
npm run build
npm audit
npm run db:generate
docker compose config -q
```

Expected: no skipped required integration tests, zero vulnerabilities, and no unexpected migration drift.

- [ ] **Step 4: Run product/security/accessibility gates**

Verify all PRD factual-profile acceptance criteria, demographic isolation, modeled/certified/unavailable labels, recent congressional contests, funding categories/outside-spending coverage, correction workflow, map fallback, source closure, WCAG 2.2 AA core flows, and browser matrix. The public MVP cannot be marked accepted while address lookup is disabled. If the environment-specific privacy gate and canary are not approved, record Phase 1 engineering as complete but public launch as blocked.

- [ ] **Step 5: Request specialist review**

Use:

- `@data-vault` for release/data integrity and query plans;
- `@security-warden` for lookup/corrections/privacy;
- `@designer` for responsive/accessibility validation;
- `@oracle` for architecture, YAGNI, maintainability, and merge readiness.

Resolve every blocker and important finding or record an approved scope change in `docs/reviews/phase-1-acceptance.md`.

- [ ] **Step 6: Commit acceptance evidence**

```bash
git add PRD.md ARCHITECTURE.md docs/reviews/phase-1-acceptance.md
git commit -m "docs: record phase 1 acceptance"
```

## Plan self-review

### Spec coverage

- Nationwide federal identity/geography: Tasks 1–4.
- Scalable browse/profile/source reads: Task 5.
- Incumbent biography, tenure, and committees: Task 6.
- ACS demographics with MOE and vintage: Task 7.
- FEC summaries and included committees: Task 8.
- 2020/2024 certified/modeled/unavailable context and Sanders rule: Task 9.
- District maps: Task 10.
- Corrections: Task 11.
- Privacy-gated address resolution: Task 12.
- Nationwide user experience and coverage: Task 13.
- Immutable releases, operations, and rollback: Task 14.
- Acceptance, security, accessibility, and review: Task 15.

### Explicitly deferred

- Rankings, comparison, evidence publication, aggregate downloads, local elections, transaction-level donor processing, and stable external APIs remain post-MVP.
- No state/year election model is promised before its review gate passes.
- No shared address collection is enabled by code alone.

### Execution order

Tasks 1–5 are sequential foundations. After Task 5, source-adapter code for Tasks 6–9 can be developed in separate path-owned lanes, but candidate loading is ordered: Task 6 baselines R2, Task 7 enriches it, Task 8 publishes R2, and Task 9 baselines/publishes R3. Task 10 depends on nationwide geometry; Task 11 is independent after Task 2; Task 12 is blocked on deployment evidence; Task 13 integrates completed source lanes; Tasks 14–15 close the release.

## Execution handoff

Recommended execution is **subagent-driven**, one task at a time with `review-quality` between tasks. Source-adapter implementation may run in parallel only after Tasks 1–5 freeze contracts, each lane owns disjoint paths, and all candidate-release writes remain sequential.
