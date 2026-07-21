# Phase 1 Task 9 election engineering evidence

## Milestone

Task 9 is evaluated as **fail-closed engineering complete; reviewed election data publication blocked**. This evidence does not claim a production R3 release, a reviewed nationwide state/year cohort, or public election-result coverage.

The current published release remains unchanged. Candidate-only and synthetic tests exercise mechanisms; they are not source evidence.

## Implemented boundary

- Canonical, versioned state/year decision snapshots represent source authority, licensing, certification, reporting-unit geometry, non-geographic policy, allocation, reconciliation, rounding, and coverage gates.
- 2020 and 2024 decision planning closes over exactly the 50 states and DC. 2022 closes over all 56 nationwide jurisdictions.
- Planning placeholders remain `unassessed`. A reviewed failure becomes explicit `unavailable — not defensibly modeled`; it is never inferred from missing rows.
- Certified original-boundary validation uses exact integer reconciliation and complete reporting-unit/option closure.
- Synthetic overlay validation uses bounded rational largest-remainder arithmetic and conserves every source/option total. It is not authorized as production election evidence.
- Reviewed decision envelopes bind their release cutoff, whole source lock, exact evidence lock entries, canonical bytes, raw receipt, approved derived snapshot, and evidence derivation closure.
- Candidate finalization changes only declared decision, coverage, and derivation rows. It does not create geography, contests, options, or results.
- Profiles visibly distinguish unassessed, unavailable, and approved review decisions. Review coverage is not presented as result coverage.

## Publication safety

Legacy releases containing only unassessed planning rows remain publishable under the pre-Task-9 lifecycle. Once any 2020/2024 decision is reviewed, promotion and roll-forward require:

1. all 102 state/DC 2020 and 2024 decisions to be reviewed;
2. both Alaska cycles to be approved; and
3. every approved decision to have corresponding certified or modeled presidential result closure.

Partial reviewed cohorts therefore remain candidate-only even after their normal seven-domain validation gate passes.

## External blockers

The retained repository does not contain the evidence required to publish R3:

- no retained 2020 certified result corpus;
- no reviewed state-authority downloads for the nationwide cohort;
- no reviewed reporting-unit geometry or election-unit crosswalks;
- no reviewed non-geographic vote policies, split weights, allocation coverage, reconciliation deltas, or rounding findings;
- licensing remains unassessed for the state/year matrix;
- the existing planning matrix is not a reviewed decision artifact.

The retained 2024 Clerk artifact supports only narrow original-boundary facts and cannot establish the required two-cycle cohort. Missing evidence remains `unassessed`/`not_collected`; it must not be relabelled `source_unavailable` or `license_unavailable` without a versioned assessment.

## Synthetic PostgreSQL mechanism evidence

The guarded integration scenario `finalizes Task 7 ACS, Task 8 FEC, and reviewed Task 9 election decisions atomically` uses the production decision envelope, adapter, run lifecycle, finalizer, verifier, profile query, and publication gate on an isolated candidate. It proves:

- one reviewed AL 2020 `unavailable` decision and one reviewed AK 2024 `approved` decision;
- exact canonical raw replay and rollback on byte mismatch;
- rejection of a changed placeholder decision identity;
- atomic decision, coverage, derivation, and input persistence;
- exact `unavailable` 1/0 `not_defensibly_modeled` and `complete` 1/1 coverage;
- Task 7 ACS and Task 8 FEC invariants remain valid;
- restart idempotency and two concurrent read-compatible verifiers;
- profile decision, coverage, source, and recursive evidence closure;
- unchanged list ordering, pagination, and facets; and
- rejection of partial-cohort promotion while the release remains a candidate.

This is synthetic mechanism evidence only. It is not a reviewed state cohort and was not promoted.

## Publication proof

Once any decision is reviewed, promotion and roll-forward require an operator-supplied proof that is replayed inside the locked publication transaction. The proof must cover all 158 canonical decision envelopes and their loaded runs, raw object receipts, exact source-lock entries, evidence usage policy, derivations, decision/coverage rows, and release predecessor. Approved 2020/2024 decisions additionally require every matching presidential contest to close completely: general round, certified/modeled status, 100% reporting, numeric denominator, applicable allocation coverage, every option numeric, exact denominator reconciliation, and no contest/result lineage outside the decision snapshot's evidence derivation.

## Validation record

- Fresh disposable database: `dsa_seats_task9_test`.
- Immutable migrations `0000`–`0002` applied successfully; 62 tables; no migration added for Task 9.
- Full guarded PostgreSQL suite: 29/29 passed.
- Non-guarded suite: 387 passed across 50 files; the 29 guarded tests were skipped there by design and passed separately.
- TypeScript, ESLint, Next production build, 94-entry source lock, zero-vulnerability audit, Compose validation, Drizzle no-drift generation, and diff checks passed.
- Final Oracle disposition: **APPROVED** after publication-proof and exact all-contest lineage closure were added.
