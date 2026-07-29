# Real Finance and Election Publication Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Recommended path:
> dispatch a fresh subagent per task, review each result with `review-quality`,
> then continue. For complex multi-agent splits, use
> `parallel-feature-development`, `team-composition-patterns`, and
> `team-communication-protocols`. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Add a fail-closed, replayable path from real official finance and election evidence to a candidate release pinned to **2026-07-18**, without claiming a launch or promoting any release until every external approval and publication proof is present.

**Architecture:** Clone R2 from R1 and promote it only after finance proof. Clone R3 only from published R2 and promote it only after election proof plus byte-for-byte/recomputed verification that inherited finance content and its digest are unchanged. Retain only canonical sanitized FEC envelopes after temporary raw API responses are deleted; retain immutable receipts for every election byte. A new additive proof migration and domain-specific acquisition/mapping/result envelopes make source bytes, review signatures, coverage closure, and publication proofs replayable inside the existing locked lifecycle transaction. The existing seven-digest validation remains necessary but is not sufficient for publication.

**Tech Stack:** Next.js 16, TypeScript 5.9, Zod 4, PostgreSQL 16/PostGIS 3.4, Drizzle, Vitest, `tsx`, OpenFEC official APIs/master/linkage files, original state election authorities, Clerk federal-election inventory, official reporting geometry/crosswalks, existing local/S3 raw-object stores.

---

## Scope and fixed decisions

- The fixed source cutoff is `2026-07-18`. The nationwide universe is exactly **541 seats = 537 occupied + 4 vacancies**. Finance coverage and review accounting must preserve all three numbers; a vacancy has no finance subject.
- A cutoff-active occupant may have no FEC candidacy. Where a declared campaign cycle exists, the subject is the **current occupant's declared campaign cycle** as of the cutoff; do not substitute the next cycle, an opponent, a committee-only guess, or a historical officeholder.
- Publish gross authorized-committee YTD totals only: do **not** net transfers. Store and calculate money as signed integer cents end-to-end; do not clamp negative reported values or coerce them to missing/nonnegative values. Display conversion occurs only at the presentation boundary.
- Do not acquire, stage, retain, publish, or replay FEC Schedule A. Delete temporary raw OpenFEC responses immediately after producing and validating their canonical sanitized envelope; retain the envelope, request/page receipts, hashes, and no-retention attestation only.
- Finance publication is permitted only when the proof reports 541 signed terminal summary dispositions and 2,164 structural coverage rows. The summary outcomes are approved finance, `vacancy`, `no_declared_cycle`, `no_authorized_committee`, or `no_report`; these resolved outcomes are distinct from unresolved mapping. Only summary closure is universal; the other 1,623 coverage rows may be explicit `not_collected` unless independently reviewed. Require zero unresolved mappings and zero pagination/amendment gaps for collected evidence, plus all seven content digests.
- Election planning is not election-result publication. Freeze the contest universe to 2020/2024 presidential general contests plus the exact reviewed 2022 Clerk federal inventory. The decision proof is exactly 158 reviewed jurisdiction/year runs: 51 for 2020, 56 for 2022, and 51 for 2024. Each frozen contest needs approved result closure or signed unavailable disposition; a signed first failure may leave downstream gates not-assessed. Geometry/crosswalk review is only required for modeled current-boundary derivation.
- Official sources only: OpenFEC APIs, candidate/committee master files, and official linkage files; original election authorities; Clerk federal-election inventory; and official reporting-unit geometry/crosswalks. Never infer a license, a mapping, a certified result, geometry compatibility, or a reviewer approval.
- Existing engineering evidence (`docs/reviews/phase-1-r2-fec-engineering.md` and `docs/reviews/phase-1-r3-election-engineering.md`) proves mechanisms only. It is not real source evidence and must not be relabeled as launch evidence.
- Create **only** additive migration `drizzle/0006_launch_data_proofs.sql`; update the matching Drizzle journal/snapshot. Never edit migrations `0000` through `0005`.

## Explicit external BLOCKED gates

These are stop conditions, not unchecked implementation work masquerading as TODOs. Leave the candidate unpromoted and record the precise blocking state if any is absent.

- **BLOCKED — FEC key:** an operator must provide a production `FEC_API_KEY` through the approved secret channel; no key may be committed, logged, included in fixtures, or copied to evidence documents.
- **BLOCKED — legal/data approval:** designated legal/data owners must approve the exact OpenFEC usage/licensing disposition, sanitized-envelope retention/no-retention policy, aggregate methodology, and publication wording. `restricted` snapshots cannot be promoted by code or operator override.
- **BLOCKED — election artifacts and licensing:** reviewers must provide pinned original-authority result artifacts, Clerk inventory artifacts, and explicit license/usage determinations for every reviewed jurisdiction/year. Official reporting geometry/crosswalk receipts and their review/licensing are additionally required only when a cohort publishes a modeled current-boundary derivation; approved original-boundary results do not require them.
- **BLOCKED — reviewer signatures:** named data reviewers must sign each mapping, vacancy disposition, election decision, result closure, and final proof using the repository-defined signed-review record. A name in a markdown checklist, an unverified Git commit, or a source-lock entry is not a signature.
- **BLOCKED — R2/R3 publication authority:** release operator and data approver must separately authorize the locked R2 finance promote/rollback/re-promote drill, then the R3 election drill from published R2. This plan does not authorize or claim launch.

## File structure and contracts

### Additive persistence and proof records

- Create `drizzle/0006_launch_data_proofs.sql` and corresponding `drizzle/meta/0006_snapshot.json`; modify `drizzle/meta/_journal.json`.
- Modify `src/db/schema.ts` for declarative parity; create `src/db/launch-data-proofs.ts` for proof construction, canonical hashing, reviewer-signature validation, and locked replay queries.
- Create `src/db/launch-data-proofs.test.ts` and extend `src/db/integration.test.ts` for migration, immutability, concurrent verifier, failure rollback, and lifecycle proof tests.

The migration must add release-scoped, candidate-only content tables (with existing mutation guards and seven-content-digest invalidation) for acquisition receipts, sanitized-response deletion attestations, FEC candidate/candidacy/committee mapping reviews, vacancy reviews, finance summary dispositions/coverage closure, election authority artifacts, Clerk inventory rows, conditional geometry/crosswalk attestations, and election result envelopes/results/lineage. Reviewer signatures and canonical publication proofs are separate immutable operational-evidence tables: apply candidate/freeze/immutability guards to them, but explicitly exempt them from seven-content-digest invalidation and bind their canonical hashes into the preflight fingerprint instead. Every persisted proof input needs source URL, SHA-256, byte size, retrieval instant, source-lock entry ID, usage status, signed reviewer identity, and a deterministic natural key. Prohibit `release_id` moves and all writes to published/retired releases.

Use signatures shaped like:

```ts
export interface SignedReview {
  readonly reviewId: string;
  readonly subjectType: "fec_mapping" | "vacancy" | "finance_closure" | "election_decision" | "election_result" | "election_geometry" | "publication";
  readonly subjectSha256: string;
  readonly reviewerId: string;
  readonly signedAt: string;
  readonly signature: string;
  readonly keyId: string;
}

export interface FinancePublicationProof {
  readonly releaseId: string;
  readonly cutoff: "2026-07-18";
  readonly summaryDispositions: 541;
  readonly financeCoverageRows: 2164;
  readonly terminalOutcomes: readonly ("approved_finance" | "vacancy" | "no_declared_cycle" | "no_authorized_committee" | "no_report")[];
  readonly unresolvedMappings: 0;
  readonly paginationGaps: 0;
  readonly amendmentGaps: 0;
  readonly digestDomains: readonly [string, string, string, string, string, string, string];
}
```

Publication proofs/signatures are immutable operational evidence outside the seven content digests, protected by candidate/freeze/immutability guards. Their canonical hashes bind directly into the preflight fingerprint; do not digest proof hashes into content tables or create a circular digest dependency. `verifyFinancePublicationProofWithClient(client, proof)` and `verifyElectionPublicationProofWithClient(client, proof)` must be SELECT-only, recompute canonical hashes, verify signatures against configured public keys, and be callable while `src/db/releases.ts` holds its deterministic release locks. Neither accepts a manually entered count as proof.

### Finance acquisition and mapping

- Create `src/ingestion/fec/acquire.ts`, `src/ingestion/fec/acquire.test.ts`, `src/ingestion/fec/mappings.ts`, `src/ingestion/fec/mappings.test.ts`, `src/ingestion/fec/publication-proof.ts`, and `src/ingestion/fec/publication-proof.test.ts`.
- Modify `src/ingestion/fec/adapter.ts`, `src/ingestion/fec/envelope.ts`, `src/ingestion/fec/aggregates.ts`, `src/ingestion/fec/finalize-fec.ts`, `src/ingestion/fec/finalize-fec.test.ts`, `scripts/ingest.ts`, `scripts/ingest.test.ts`, `scripts/finalize-fec.ts`, and `scripts/finalize-fec.test.ts`.
- Create `scripts/acquire-fec.ts`, `scripts/review-fec-mappings.ts`, and `scripts/prove-finance-publication.ts`, each with adjacent `*.test.ts` parser/behavior tests.

Replace the current single-envelope/single-run finalizer constraint with a bounded multi-run contract, such as:

```ts
export interface FinalizeCandidateFecOptions {
  readonly candidateReleaseId: string;
  readonly sourceReleaseId: string;
  readonly runIds: readonly string[]; // one canonical envelope per reviewed subject/scope
  readonly mappingProofId: string;
  readonly financeProofId: string;
  readonly cutoff: "2026-07-18";
}
```

The finalizer must reject duplicate seat/cycle scopes, partial collected run sets, mixed validated/loaded states, stale cutoff, unsigned mappings, an envelope whose declared subject differs from the cutoff-active incumbent, unresolved page continuation, or incomplete amendment chain. It must accept signed terminal `no_declared_cycle`, `no_authorized_committee`, and `no_report` summaries without inventing a candidate/committee. It remains idempotent and atomic across accepted runs, revalidates the R2 lifecycle, all seven digests, and the persisted finance proof after loading.

Change finance value contracts, SQL constraints, staging comparisons, exact-money conversion, aggregates, repository DTOs, and rendering to signed cents. In particular, replace the `normalizeFecCents` nonnegative grammar and `Math.floor` conversion in `src/ingestion/fec/adapter.ts`/`finalize-fec.ts`; retain exact two-decimal validation without rounding. Update the nonnegative finance schemas in `src/domain/contracts.ts` and `src/domain/repository.ts`, and database checks in the new migration only where additive replacement constraints are required. Tests must prove `-0.01`, negative cash/receipts/disbursements, and positive values round-trip identically; invalid precision, overflow, and any clamping fail.

### Election acquisition, result loading, and proof

- Create `src/ingestion/elections/acquire.ts`, `src/ingestion/elections/acquire.test.ts`, `src/ingestion/elections/results.ts`, `src/ingestion/elections/results.test.ts`, `src/ingestion/elections/result-envelope.ts`, `src/ingestion/elections/result-envelope.test.ts`, `src/ingestion/elections/clerk-inventory.ts`, `src/ingestion/elections/clerk-inventory.test.ts`, `src/ingestion/elections/publication-proof.ts`, and `src/ingestion/elections/publication-proof.test.ts`.
- Modify `src/ingestion/elections/adapter.ts`, `src/ingestion/elections/decision-envelope.ts`, `src/ingestion/elections/finalize-elections.ts`, `src/ingestion/elections/finalize-elections.test.ts`, `src/db/releases.ts`, `scripts/ingest.ts`, `scripts/ingest.test.ts`, `scripts/finalize-elections.ts`, `scripts/finalize-elections.test.ts`, `scripts/release-lifecycle.ts`, and `scripts/release-lifecycle.test.ts`.
- Create `scripts/acquire-election-artifacts.ts`, `scripts/load-election-results.ts`, `scripts/review-election-cohort.ts`, and `scripts/prove-election-publication.ts`, with parser/behavior tests.

Separate zero-row decision-envelope runs from real election-byte acquisition and result loading. Approved-result envelopes must bind original artifact receipt(s), inventory row, authority/certification, election-time geography, option/result rows, reconciliation fields, and reviewer signatures; modeled current-boundary derivations additionally bind reviewed reporting geometry/crosswalk receipt(s). Signed unavailable dispositions bind their first failed gate and evidence but require no geometry or fabricated contest/result rows. Store every original election artifact and derived result envelope through `RawObjectStore`; unlike temporary FEC API payloads, do not delete election raw bytes. Reject an approved-result envelope without an object receipt/version, byte-size/hash match, source-lock closure, explicit usage determination, and result reviewer signature.

The new result loader must create contests, options, results, provenance, coverage, and derivations only from approved-result envelopes; a signed unavailable disposition creates coverage/decision evidence only and no fabricated contest, option, or result row. It cannot promote a decisions-only candidate. For approved results, the closure verifier joins the frozen inventory to result rows and proves: expected contest exists, general round and authority status match, all required options are numeric, reporting is 100%, denominator is numeric, exact reconciliation succeeds, applicable allocation coverage is complete, and all lineage belongs to the approved decision derivation. Preserve original-boundary results without requiring geometry/crosswalk receipts; modeled current-boundary derivations require reviewed official reporting-unit geometry/crosswalks and never substitute inferred VTDs.

## Task 1: Freeze proof schemas and additive migration

**Files:** migration, schema, proof module, and tests listed above.

- [ ] **Step 1: Write failing migration and proof-contract tests.** Assert `0006_launch_data_proofs.sql` is the only new migration, `0000`–`0005` hashes/content are untouched, all proof tables are release-immutable, unsigned/malformed reviews fail, and a proof cannot claim a count inconsistent with persisted rows.
- [ ] **Step 2: Implement the additive DDL and Drizzle metadata.** Add constraints for fixed cutoff, unique subject identity, receipt hash/size, valid signature references, candidate-only writes, and deterministic proof inputs. Do not alter existing migrations; use additive `ALTER TABLE ... DROP/ADD CONSTRAINT` only if needed to permit signed cents.
- [ ] **Step 3: Implement canonical proof/review helpers.** Canonically serialize sorted rows, hash the subject before signing, require configured public-key verification, and expose transaction-scoped verifiers. Make failures finite (`LAUNCH_PROOF_*`) and leave candidate data/gate unchanged.
- [ ] **Step 4: Run red tests then focused green tests.** Run `npm run test:run -- src/db/launch-data-proofs.test.ts src/db/schema.test.ts`; then `TEST_DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_test npm run test:integration -- -t "launch data proof"`.
- [ ] **Step 5: Commit the isolated foundation.** `git add drizzle src/db && git commit -m "feat: add launch data publication proofs"`

## Task 2: Build real FEC acquisition and sanitized envelopes

- [ ] **Step 1: Write acquisition tests first.** Mock official paginated candidate, committee, report-summary, master, and linkage responses. Cover missing key, cutoff pagination boundary, duplicate rows, continuation omission, retry/error, Schedule A endpoint/path/body rejection, raw deletion failure, sanitization leak detection, and deterministic envelope bytes.
- [ ] **Step 2: Implement `acquire-fec` and register the production adapter.** `scripts/ingest.ts` must expose `--source fec` only when `FEC_API_KEY`, raw store, and approved configuration exist; otherwise return a finite unavailable/blocked error before network or database writes. Use only OpenFEC official endpoints/files needed for candidate, committee, authorized linkage, and F3 summary data.
- [ ] **Step 3: Enforce temporary-raw deletion.** Stream each response into a private temporary location, verify request/page receipt and page hash, sanitize only allowed summary fields into a canonical envelope, persist the envelope through `RawObjectStore`, then delete temporary raw bytes and persist an attestation. If deletion/attestation fails, abort and remove the candidate transaction; never retain Schedule A or contributor fields.
- [ ] **Step 4: Capture complete acquisition closure.** Persist exact request canonicalization (without key), response/page count, cursors, continuation status, source-lock IDs, and envelope receipt. Pagination must be deterministic and fail closed on any unvisited or repeated page.
- [ ] **Step 5: Verify.** Run `npm run test:run -- src/ingestion/fec/acquire.test.ts src/ingestion/fec/adapter.test.ts scripts/ingest.test.ts`; run `npm run typecheck && npm run lint`.
- [ ] **Step 6: Commit acquisition only.** `git add src/ingestion/fec scripts/ingest.ts scripts/acquire-fec.ts && git commit -m "feat: acquire sanitized FEC summaries"`

## Task 3: Review cutoff-active FEC mappings and signed money

- [ ] **Step 1: Write mapping and money regression tests.** Generate 537 occupied cutoff-active seats and four vacancies. Prove current incumbent/campaign-cycle selection where declared, authorized committee closure where applicable, signed `no_declared_cycle`/`no_authorized_committee`/`no_report` terminal outcomes, unresolved mapping failure, vacancy disposition, negative cents preservation, transfer-gross behavior, and complete amendment leaves.
- [ ] **Step 2: Implement mapping compiler/reviewer workflow.** Join official FEC candidate/committee master/linkage data to existing current membership/candidacy records by stable official IDs, effective dates, and declared cycle—never fuzzy names. `review-fec-mappings` emits an approved mapping, signed terminal outcome, or explicit unresolved disposition. Require exactly 541 signed terminal summaries (including four vacancies), not 537 assumed candidacies, before finalization.
- [ ] **Step 3: Convert all finance paths to signed cents.** Update domain/persistence/DTO contracts and adapters as described above. Aggregate selected authorized committees' gross YTD `total_receipts` and `total_disbursements`; transfers remain within those reported gross fields and are never netted. Keep cash as reported. Make exact arithmetic bigint/string-cent based until display.
- [ ] **Step 4: Repair multi-run FEC finalization.** Load every reviewed envelope scope atomically, preserve existing raw replay and idempotency semantics, and reject a real production snapshot whose usage status is `restricted` until legal/data approval changes it through a signed review record.
- [ ] **Step 5: Verify.** Run `npm run test:run -- src/ingestion/fec src/domain/contracts.test.ts src/domain/repository.test.ts scripts/finalize-fec.test.ts`; run the focused integration test for multi-run FEC finalization.
- [ ] **Step 6: Commit mappings/finalizer.** `git add src/ingestion/fec src/domain src/db/schema.ts scripts/finalize-fec.ts scripts/review-fec-mappings.ts && git commit -m "feat: finalize reviewed FEC finance scopes"`

## Task 4: Produce and verify the finance publication proof

- [ ] **Step 1: Write proof failure tests.** Independently break one summary disposition, coverage row, mapping/vacancy review, page receipt, amendment chain, signature, or digest; each must fail without promotion and identify the specific finite failure code.
- [ ] **Step 2: Implement `prove-finance-publication`.** Recompute rather than trust supplied values: exactly 541 signed terminal summaries, 2,164 structural coverage rows, and zero unresolved mappings/pagination/amendment gaps for collected evidence. Require all seven current release digests and bind their hashes to the proof; only summary closure is universal, and the other 1,623 coverage rows may be explicit `not_collected` unless independently reviewed.
- [ ] **Step 3: Add Task 8 publication evidence.** Create `docs/reviews/phase-1-r2-fec-publication.md` only after the external gates are satisfied; otherwise document the blocking evidence/status without calling it publication proof or launch. It must reference proof ID/checksum, source-lock revision, reviewer IDs/signatures, retention attestations, and candidate release ID—not credentials or raw contributor data.
- [ ] **Step 4: Run the candidate verification.** Run `npm run test:run -- src/ingestion/fec/publication-proof.test.ts src/db/launch-data-proofs.test.ts`; `npm run data:verify`; and the real candidate verifier using approved production environment variables.
- [ ] **Step 5: Commit only implementation/evidence that exists.** `git add src/ingestion/fec src/db scripts/prove-finance-publication.ts docs/reviews/phase-1-r2-fec-publication.md && git commit -m "feat: verify finance publication closure"`

## Task 5: Acquire election artifacts and signed decisions

- [ ] **Step 1: Write acquisition/replay tests.** Cover original authority and Clerk inventory fetches, raw receipt version/hash/byte-size mismatch, unapproved license, missing source-lock entry, missing reviewer signature, decision-only no-result behavior, and deterministic reruns.
- [ ] **Step 2: Implement election artifact acquisition.** Register `--source elections` only with the concrete acquisition adapter and configuration. Fetch/persist exact source bytes from original authorities, Clerk inventory, and reviewed official geometry/crosswalks. Record source URL, lock entry, license determination, receipt, and retrieval time; never synthesize a source from a landing page.
- [ ] **Step 3: Compile signed decision envelopes and freeze the contest inventory.** Generate exactly 51 2020 (50 states + DC), 56 2022 (states/DC plus AS/GU/MP/PR/VI), and 51 2024 decision envelopes. Freeze 2020/2024 presidential general contests and the exact reviewed 2022 Clerk federal inventory. Preserve downstream `not_assessed` after a signed first failure; only a signed unavailable disposition closes an unavailable contest.
- [ ] **Step 4: Strengthen Task 9 finalization.** Keep decision envelopes distinct from source evidence, require 158 unique decision runs for a cohort proof, and retain all decision raw receipts. Update CLI and lifecycle parsing so election publication proof cannot be represented by arbitrary decision run IDs and lock-entry IDs alone.
- [ ] **Step 5: Verify and commit.** Run `npm run test:run -- src/ingestion/elections/acquire.test.ts src/ingestion/elections/finalize-elections.test.ts scripts/finalize-elections.test.ts`; commit with `feat: acquire reviewed election evidence`.

## Task 6: Load election results and prove Clerk inventory closure

- [ ] **Step 1: Write result-loader tests first.** Cover the frozen 2020/2024 presidential-general and exact 2022 Clerk contest inventory, approved closure versus signed unavailable disposition, original-boundary result persistence, all-option numeric closure, exact denominator reconciliation, and a signed first failure leaving downstream geometry/rounding gates `not_assessed`; reject malformed geometry/crosswalk and inferred-license results only when a modeled derivation is attempted.
- [ ] **Step 2: Implement result envelopes and loader.** `load-election-results` accepts only approved, receipt-backed envelopes. It loads contests/options/results plus provenance/coverage/derivations in one candidate transaction and preserves every raw election object for replay.
- [ ] **Step 3: Implement frozen-universe closure.** Parse the reviewed Clerk 2022 inventory into exact expected contest keys and combine it with 2020/2024 presidential-general keys. Each item requires approved result closure or signed unavailable disposition; unavailable is a reviewed status, not a fabricated result. Do not demand universal geometry or zero downstream `not_assessed` states after signed first failure.
- [ ] **Step 4: Gate modeled/current-boundary work.** Require original reporting-unit geometry and explicit official crosswalk/weights with signed review only before a current-boundary derivation. Keep absent/failed derivation evidence unavailable or not-assessed as appropriate and do not substitute Census VTDs.
- [ ] **Step 5: Verify and commit.** Run `npm run test:run -- src/ingestion/elections/results.test.ts src/ingestion/elections/clerk-inventory.test.ts src/repositories`; commit with `feat: load replayable election results`.

## Task 7: Bind finance proof into locked R2 publication and drill rollback

- [ ] **Step 1: Write R2 lifecycle tests.** Prove R2 promotion fails for absent FEC proof, restricted/unapproved source, unsigned review, finance summary/count mismatch, stale proof hash, raw replay mismatch, or post-proof candidate mutation. Prove no pointer change in every failure and prove no election proof can be supplied to or required by R2.
- [ ] **Step 2: Extend `src/db/releases.ts` and lifecycle CLI for R2.** Clone R2 only from R1. Under existing deterministic locks, replay finance receipt closure, call only the finance transaction-scoped verifier, recheck all seven digests and candidate validation, bind immutable operational proof/signature hashes directly into the preflight fingerprint, then transition the pointer. Reject legacy run-ID-only proof as insufficient.
- [ ] **Step 3: Add operations documentation.** Create `docs/operations/real-finance-election-publication-runbook.md` with separate exact R2 and R3 acquire, review, proof, preflight, promote, rollback, and re-promote commands; document credential redaction, FEC deletion attestations, election retention, owner roles, and failure-code triage. Update `docs/data/source-coverage.md` only with actual candidate evidence.
- [ ] **Step 4: Execute a disposable R2 drill.** On a fresh dedicated test database, migrate through `0006`, load synthetic-but-production-shaped fixtures, validate finance proof replay, promote R2 from R1, roll back to R1, and re-promote R2. Then mutate an envelope/proof receipt to prove failed preflight leaves R1 active.
- [ ] **Step 5: Run final technical commands.**

  ```bash
  npm run test:run -- src/ingestion/fec src/ingestion/elections src/db scripts
  npm run typecheck
  npm run lint
  npm run data:verify
  TEST_DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_test npm run test:integration
  npm run build
  npm run db:generate
  docker compose config -q
  ```

- [ ] **Step 6: Commit R2 lifecycle closure.** `git add src/db/releases.ts src/ingestion scripts docs/operations docs/data && git commit -m "ops: gate R2 finance publication proof"`

## Task 8: Bind election proof into locked R3 publication

- [ ] **Step 1: Write R3 inheritance and lifecycle tests.** Clone R3 only from published R2. Prove promotion fails for absent election proof, fewer/different than 158 decision runs, missing frozen-contest closure, stale proof hash, raw replay mismatch, post-proof mutation, or any byte-for-byte/recomputed mismatch in inherited finance rows or finance digest. Prove no pointer change in every failure.
- [ ] **Step 2: Implement R3 preflight.** Under deterministic locks, verify published R2 predecessor, recompute and byte-compare inherited finance content and digest against R2, replay election receipt closure, call only the election proof verifier, recheck candidate content digests, and bind election operational proof/signature hashes directly into the preflight fingerprint. R3 accepts an election-only proof over inherited R2 finance.
- [ ] **Step 3: Execute a disposable R3 drill.** Clone from the published fixture R2, load election fixtures, validate inheritance and election replay, promote R3, roll back to R2, and re-promote R3. Mutate inherited finance content/digest and an election receipt independently to prove each failed preflight leaves R2 active.
- [ ] **Step 4: Commit R3 lifecycle closure.** `git add src/db/releases.ts src/ingestion scripts docs/operations docs/data && git commit -m "ops: gate R3 election publication proof"`

## Execution order and review boundaries

1. Task 1 is required before either source lane. Tasks 2–4 and Task 7 complete and publish R2 from R1 before Tasks 5–6 and Task 8 create R3 from published R2; promotion evidence is stage-specific.
2. Finance acquisition and mapping may be developed in separate path-owned branches after Task 1, but finalization/proof writes remain serialized against one candidate release.
3. Election decisions may be acquired per jurisdiction/year, but approved result loading follows signed authority/license review and, only for modeled current-boundary derivations, signed geometry/crosswalk review. Signed unavailable dispositions stop at their first failed gate. Commit independently reviewable state cohorts; do not mix unrelated authority artifacts.
4. Tasks 7 and 8 are separately authorized release drills. Each is blocked by its applicable external gates and must not alter a published pointer during engineering verification.

## Plan self-review

- Addresses the known gaps: concrete FEC/election acquisition commands; multi-run FEC finalization; reviewed candidacy/committee mappings; Task 8 publication proof; approved-versus-restricted resolution; signed money; Task 9 result loader; election-byte receipts/replay.
- Retains the required safety properties: cutoff-active subject selection, gross YTD/no transfer netting, no Schedule A, sanitized FEC retention with raw deletion, election raw retention, immutable additive migration, exact proof counts, seven digests, original-authority evidence, and rollback/re-promote testing.
- Does **not** claim production launch, R2/R3 publication, source approval, reviewer signatures, licensing, or credentials. Those remain explicit BLOCKED gates until supplied and validated.
