# Office-Universe Pilot Readiness Implementation Plan

> **For agentic workers:** Execute task-by-task. Dispatch a fresh subagent per task, review with `review-quality`, then continue. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make one future state-legislative source slice safe to qualify, replay, and shadow-ingest without claiming coverage or publishing data.

**Architecture:** Keep `office_universe` isolated and non-public. Add append-only evidence/run tables beside the 250-slot backlog registry. Source definitions are scoped and reviewed; verified raw bytes remain in retained object storage while Postgres keeps receipts and sanitized records. Indiana and North Carolina get read-only qualification packets; only one can advance after the charter gate fully passes.

**Tech Stack:** TypeScript, Zod, PostgreSQL, Drizzle SQL, `pg`, Vitest, `scripts/rapid/retain-source.ts`.

---

## Fixed scope

- Pilot readiness only. Do not configure unavailable slots, publish routes, promote holders, run formulas, or claim coverage.
- Preserve `drizzle/0017_nationwide_office_universe_intake.sql`; use additive `0018`.
- Preserve federal isolation. Internal FKs may target only `office_universe` tables.
- Existing `(state_code, family)` rows are a backlog index. Reseeding cannot overwrite them.
- Retained official bytes stay outside Postgres. Finance remains blocked until a source-specific privacy allowlist is reviewed.
- Snapshot authority/hash/parser/reconciliation/certification faults quarantine a snapshot. Isolated records quarantine only themselves.
- Candidate scope: Indiana + North Carolina, one closed cycle, state-legislative offices. No local expansion.

## File structure

- Create `drizzle/0018_office_universe_pilot_readiness.sql` — reviewed sources, immutable receipts, runs, snapshots, issues, internal FKs, append-only ingest grants.
- Modify `src/db/schema.ts`, `src/db/schema.test.ts` — schema/migration parity.
- Modify `src/office-universe/nationwide-intake.ts` — source, receipt, snapshot contracts; holder guard.
- Create `src/office-universe/source-review.ts`, `raw-store.ts`, `run-source.ts` plus tests.
- Modify `src/office-universe/repository.ts`, `repository.test.ts`, and `scripts/seed-nationwide-office-universe-registry.ts` — insert-only bootstrap and atomic record retention.
- Create `src/office-universe/fixtures/qualified-source.ts` — synthetic reviewed fixture only.
- Create `docs/data/office-universe/qualification-packet-schema.md`, `indiana-state-legislative-qualification.md`, and `north-carolina-state-legislative-qualification.md`.
- Modify `docs/architecture/nationwide-office-universe-intake.md` and `docs/architecture/phase-b-state-legislative-pilot-charter.md`.

## Task 1: Freeze source review and snapshot contracts

**Files:** `src/office-universe/nationwide-intake.ts`, `src/office-universe/source-review.ts`, `src/office-universe/nationwide-intake.test.ts`, `src/office-universe/source-review.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
expect(reviewSourceDefinition(qualifiedSource())).toMatchObject({ status: "reviewed" });
expect(reviewSourceDefinition({ ...qualifiedSource(), authorityScope: [] }).status).toBe("rejected");
expect(reviewSourceDefinition({ ...qualifiedSource(), retentionBasis: null }).status).toBe("rejected");
expect(assessSnapshot({ receipts: [hashMismatchReceipt], recordDecisions: [] }).disposition).toBe("quarantined");
```

- [ ] **Step 2: Confirm red**

Run: `npm run test:run -- src/office-universe/nationwide-intake.test.ts src/office-universe/source-review.test.ts`

Expected: FAIL; contracts do not exist.

- [ ] **Step 3: Add total contracts**

```ts
export type SourceDefinitionStatus = "draft" | "reviewed" | "rejected" | "retired";
export type SourceDefinition = Readonly<{
  id: string; stateCode: StateCode; family: SourceFamily; sourceKey: string;
  authorityTier: "official" | "aggregator"; authorityScope: readonly [string, ...string[]];
  precedence: number; sourceUrl: string; retentionBasis: string;
  allowedKinds: readonly [RawIntakeRecord["kind"], ...RawIntakeRecord["kind"][]];
  privacyPolicy: "public_office_only" | "finance_allowlist"; status: SourceDefinitionStatus;
}>;
export type SnapshotDisposition = "accepted" | "accepted_with_row_quarantine" | "quarantined";
```

`reviewSourceDefinition` accepts only HTTPS sources with nonempty authority scope, positive precedence, retention basis, and allowed kinds. Reject `finance_allowlist` until Task 4. `assessSnapshot` quarantines unverified receipt, authority mismatch, parser drift, reconciliation failure, or certification ambiguity.

- [ ] **Step 4: Guard holder transition**

Return `null` from `holderTransitionFromResult` unless maturity is `certified_winner` and caller supplies a sourced term-effective timestamp. It may only emit `holder_pending_transition`.

- [ ] **Step 5: Confirm green and commit**

Run: `npm run test:run -- src/office-universe/nationwide-intake.test.ts src/office-universe/source-review.test.ts`

Run: `git add src/office-universe/nationwide-intake.ts src/office-universe/nationwide-intake.test.ts src/office-universe/source-review.ts src/office-universe/source-review.test.ts src/office-universe/fixtures/qualified-source.ts && git commit -m "feat(intake): gate reviewed source snapshots"`

## Task 2: Add immutable evidence and run persistence

**Files:** `drizzle/0018_office_universe_pilot_readiness.sql`, `src/db/schema.ts`, `src/db/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
expect(migrationSql).toContain("CREATE TABLE office_universe.source_definitions");
expect(migrationSql).toContain("CREATE TABLE office_universe.retained_object_receipts");
expect(migrationSql).toContain("CREATE TABLE office_universe.intake_snapshots");
expect(migrationSql).toContain("REFERENCES office_universe.source_definitions(id)");
expect(migrationSql).not.toMatch(/REFERENCES\s+(public\.|offices|seat_cycles)/);
```

- [ ] **Step 2: Confirm red**

Run: `npm run test:run -- src/db/schema.test.ts`

Expected: FAIL; `0018` is absent.

- [ ] **Step 3: Implement additive SQL**

Create `source_definitions` with source identity, state/family, authority scope JSON array, precedence, HTTPS URL, retention basis, allowed kinds JSON array, privacy policy, status, reviewer/time. Create `retained_object_receipts` with immutable source id, locator, byte size, SHA-256, retrieved time, final URL, parser version. Create `intake_runs` (`running|succeeded|failed|cancelled`), `intake_snapshots`, and `snapshot_issues`; link only inside `office_universe`.

Grant `dsa_seats_ingest` only `SELECT, INSERT` on receipt/run/snapshot/issue tables; never `UPDATE, DELETE`. Preserve migration-owner DDL access. Do not FK historic `raw_payloads.snapshot_id` until deterministic backfill is proven.

- [ ] **Step 4: Add Drizzle parity and verify**

Use `unknown` for JSONB. No federal relations.

Run: `npm run test:run -- src/db/schema.test.ts && npm run typecheck`

Run: `git add drizzle/0018_office_universe_pilot_readiness.sql src/db/schema.ts src/db/schema.test.ts && git commit -m "feat(intake): persist immutable pilot evidence"`

## Task 3: Make bootstrap and record retention safe

**Files:** `src/office-universe/repository.ts`, `src/office-universe/repository.test.ts`, `scripts/seed-nationwide-office-universe-registry.ts`

- [ ] **Step 1: Write failing tests**

```ts
await seedSourceRegistry(db, buildNationwideSourceRegistry());
expect(calls.some((call) => call.text.includes("DO UPDATE"))).toBe(false);
await retainRawIntake(db, quarantinedRecord);
expect(calls.map((call) => call.text)).toEqual(expect.arrayContaining(["BEGIN", expect.stringContaining("raw_payloads"), expect.stringContaining("intake_issues"), "COMMIT"]));
```

Also simulate issue-insert failure and expect `ROLLBACK`.

- [ ] **Step 2: Confirm red**

Run: `npm run test:run -- src/office-universe/repository.test.ts`

- [ ] **Step 3: Implement**

Use `ON CONFLICT(state_code,family) DO NOTHING`. Return `{ inserted, existing }`; print both in the seed script. Require `Pool` for `retainRawIntake`, acquire client, `BEGIN`, retain raw record plus all issues, `COMMIT`; rollback/rethrow/release on all errors. Do not project graph rows.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:run -- src/office-universe/repository.test.ts && npm run typecheck`

Run: `git add src/office-universe/repository.ts src/office-universe/repository.test.ts scripts/seed-nationwide-office-universe-registry.ts && git commit -m "fix(intake): preserve registry and atomic issues"`

## Task 4: Verify retained objects before intake

**Files:** `src/office-universe/raw-store.ts`, `src/office-universe/raw-store.test.ts`, `src/office-universe/nationwide-intake.ts`, `src/office-universe/nationwide-intake.test.ts`

- [ ] **Step 1: Write failing filesystem tests**

```ts
await expect(verifyRetainedObject({ root, locator: "in/2024/results.json", expectedSha256: digest, expectedBytes: bytes.length })).resolves.toMatchObject({ sha256: digest, byteSize: bytes.length });
await expect(verifyRetainedObject({ root, locator: "../escape.json", expectedSha256: digest, expectedBytes: bytes.length })).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID");
await expect(verifyRetainedObject({ root, locator: "in/2024/results.json", expectedSha256: "a".repeat(64), expectedBytes: bytes.length })).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_SHA256_MISMATCH");
```

- [ ] **Step 2: Confirm red**

Run: `npm run test:run -- src/office-universe/raw-store.test.ts`

- [ ] **Step 3: Implement read-only verification**

Use `resolve`, `relative`, `lstat`, and streaming SHA-256. Reject absolute/traversal locators, symlink escape, non-files, invalid digest, byte mismatch, and hash mismatch. Return `{ locator, byteSize, sha256 }`; never fetch/write/delete/parse.

Replace keyword PII scanning with recursive reviewed key allowlists. Accept `public_office_only` data only through allowlist. Reject every `finance_allowlist` record until reviewed fields exist.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:run -- src/office-universe/raw-store.test.ts src/office-universe/nationwide-intake.test.ts`

Run: `git add src/office-universe/raw-store.ts src/office-universe/raw-store.test.ts src/office-universe/nationwide-intake.ts src/office-universe/nationwide-intake.test.ts && git commit -m "feat(intake): verify retained object receipts"`

## Task 5: Add manual shadow-run orchestration

**Files:** `src/office-universe/run-source.ts`, `src/office-universe/run-source.test.ts`, `src/office-universe/repository.ts`, `docs/architecture/nationwide-office-universe-intake.md`

- [ ] **Step 1: Write failing orchestration tests**

```ts
await expect(runReviewedSource(validDependencies)).resolves.toMatchObject({ snapshotDisposition: "accepted", normalizedRecordCount: 0 });
await expect(runReviewedSource(oneBadRowDependencies)).resolves.toMatchObject({ snapshotDisposition: "accepted_with_row_quarantine" });
await expect(runReviewedSource(schemaDriftDependencies)).resolves.toMatchObject({ snapshotDisposition: "quarantined", normalizedRecordCount: 0 });
```

Assert graph-projection methods are never called.

- [ ] **Step 2: Confirm red**

Run: `npm run test:run -- src/office-universe/run-source.test.ts`

- [ ] **Step 3: Implement bounded run**

```ts
export async function runReviewedSource(input: Readonly<{
  source: SourceDefinition; requestedCutoff: string; receipt: RetainedObjectReceipt;
  loadRecords: () => Promise<readonly RawIntakeRecord[]>; repository: IntakeRepository;
}>): Promise<Readonly<{ runId: string; snapshotId: string; snapshotDisposition: SnapshotDisposition; normalizedRecordCount: 0 }>>;
```

Allow only reviewed sources and UTC cutoffs; verify receipt before run creation; retain each raw row; aggregate `assessSnapshot`; persist systemic issues. Always return zero normalized records. No scheduler, retry loop, graph projection, coverage update, calculation, or holder projection.

- [ ] **Step 4: Document, verify, commit**

Document `refresh-policy.ts` as advisory, not authorization. Only manual reviewed runs are allowed.

Run: `npm run test:run -- src/office-universe/run-source.test.ts src/office-universe/repository.test.ts src/office-universe/raw-store.test.ts && npm run typecheck`

Run: `git add src/office-universe/run-source.ts src/office-universe/run-source.test.ts src/office-universe/repository.ts docs/architecture/nationwide-office-universe-intake.md && git commit -m "feat(intake): add shadow source runs"`

## Task 6: Qualify Indiana and North Carolina read-only

**Files:** `docs/data/office-universe/qualification-packet-schema.md`, `docs/data/office-universe/indiana-state-legislative-qualification.md`, `docs/data/office-universe/north-carolina-state-legislative-qualification.md`, `docs/architecture/phase-b-state-legislative-pilot-charter.md`

- [ ] **Step 1: Define packet schema**

Require exactly one state, `state_legislative`, closed cycle, UTC cutoff, and decision `not_qualified|qualified_for_shadow_intake|rejected`. Require rows for office/district universe, filing, results/certification, calendar, finance, geography, election-system diversity, missingness.

Each row requires requirement, status (`retained|not_collected|source_unavailable|not_defensibly_modeled|blocked_by_retention|quarantined`), authority, HTTPS URL, retained path, SHA-256, retrieval time, retention basis, scope, omissions, and rationale. `retained` is invalid without all evidence fields.

- [ ] **Step 2: Create both packets**

Begin each packet:

```md
**Decision:** `not_qualified`

This packet is an evidence assessment, not a coverage claim or source-configuration authorization. Every unverified source remains explicitly uncollected.
```

Populate only repository-retained or newly retained official facts. Rapid result receipts are context, never automatic gate satisfaction. Use `not_collected`; do not guess endpoints, rights, certification, or geography mapping.

- [ ] **Step 3: Verify and record advancement rule**

Run: `npm run data:verify`

Expected before retaining new qualification evidence: `Verified 1144 source-lock entries.` Advance only one state after all eight requirements are retained, no systemic quarantine remains, a reviewed source exists, replay works, and manual shadow run succeeds. Zero qualified states is valid.

- [ ] **Step 4: Commit**

Run: `git add docs/data/office-universe docs/architecture/phase-b-state-legislative-pilot-charter.md && git commit -m "docs(intake): add pilot qualification gates"`

## Task 7: Prove using explicit disposable DB only

**Files:** `src/office-universe/pilot-readiness.integration.test.ts`, `docs/architecture/nationwide-office-universe-intake.md`

- [ ] **Step 1: Add opt-in integration test**

Skip clearly without `OFFICE_UNIVERSE_DATABASE_URL`. With an explicit target, migrate, seed twice, create one synthetic reviewed source/receipt, run accepted and quarantined snapshots, assert 250 registry rows, one reviewed source, both dispositions, and zero federal writes.

- [ ] **Step 2: Static verification**

Run: `npm run typecheck && npm run test:run -- src/office-universe src/db/schema.test.ts && npm run data:verify && git diff --check`

Expected: PASS.

- [ ] **Step 3: Approved-target proof**

Run: `DATABASE_URL="$OFFICE_UNIVERSE_DATABASE_URL" npm run db:migrate`

Run: `OFFICE_UNIVERSE_DATABASE_URL="$OFFICE_UNIVERSE_DATABASE_URL" npm run seed:nationwide-office-universe-registry`

Run: `OFFICE_UNIVERSE_DATABASE_URL="$OFFICE_UNIVERSE_DATABASE_URL" npm run test:run -- src/office-universe/pilot-readiness.integration.test.ts`

Expected: first seed inserts 250; second inserts zero; test proves isolation and append-only evidence. Never use production or unspecified DB.

## Exit criteria

1. Bootstrap cannot overwrite reviewed configuration.
2. Intake has verified retained-object provenance and atomic issue persistence.
3. Ingest cannot mutate/delete evidence, runs, snapshots, or systemic issues.
4. Shadow runs have no graph, public, formula, coverage, or holder side effects.
5. Indiana and North Carolina have source-locked packets with explicit missingness.
6. At most one state is qualified; zero is valid.
7. Explicit local/staging proof passes.

Only then plan one chosen state, one closed cycle, state-legislative universe plus filings/calendar/results/certification/geography/finance, deterministic replay, normalization, reconciliation, and second-state comparison. Do not expand to all 50 states.
