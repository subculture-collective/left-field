# Phase 1 R2 ACS candidate evidence

Date: 2026-07-20

Environment: disposable local PostgreSQL/PostGIS development database with a local raw-object store. This is not production deployment evidence.

## Published surface

The candidate adds only three direct 2024 ACS five-year table indicators:

- total population (`B01003_001E/M`, count);
- median age (`B01002_001E/M`, years);
- median household income (`B19013_001E/M`, 2024 inflation-adjusted USD).

Age bands, educational attainment, race/ethnicity, housing tenure, percentages, and urbanicity remain deferred. ACS values are profile display data only; they do not participate in filtering, ordering, search, pagination, ranking, or export.

## Retained-source run

The source-locked Census tables were fetched with redirect refusal, exact byte-size and SHA-256 verification, then retained through the local raw-object store:

```bash
DATABASE_URL=... RAW_OBJECT_ROOT=.blacktower/deepwork/raw-task7 \
  npm run ingest -- --source acs --release rel_r2_acs_evidence \
  --cutoff 2026-07-18 --dry-run
```

The validated run IDs, in population/age/income order, were:

- `run_8c57ee0914dbac835e243d8bff7f020ca45a46440d4c40cb76c56c629ef9b32f`
- `run_b9a342852107d3ef0bdbcd0d3eb995b6657ac00e2f0d8ade2a84b9e3fa9ee6b3`
- `run_80c57b66eb7a3c7dc5497c07bb1458741a61a1ced9f93e0afe407e3328baebe9`

They were finalized atomically into the clean Task 6 successor:

```bash
DATABASE_URL=... RAW_OBJECT_ROOT=.blacktower/deepwork/raw-task7 \
  npm run finalize:acs -- \
  --release rel_r2_acs_evidence \
  --source-release rel_r1_nationwide_smoke \
  --population-run run_8c57ee0914dbac835e243d8bff7f020ca45a46440d4c40cb76c56c629ef9b32f \
  --age-run run_b9a342852107d3ef0bdbcd0d3eb995b6657ac00e2f0d8ade2a84b9e3fa9ee6b3 \
  --income-run run_80c57b66eb7a3c7dc5497c07bb1458741a61a1ced9f93e0afe407e3328baebe9
```

The command returned `validated_candidate`. Repeating the exact command replayed the three raw receipts, rechecked the nationwide gate and Task 6/7 invariants under one transaction, and returned the same result without changing content. Finalization binds every run to the verified lock entry's exact ID, URL, SHA-256, byte size, adapter version, upstream-release snapshot identity, and approved snapshot metadata. Replay also requires exact equality for persisted estimate and MOE missing reasons.

## Closure and lifecycle evidence

- `rel_r1_nationwide_smoke` remained published with zero ACS definitions and observations, seven domain digests, and a valid nationwide gate.
- `rel_r2_acs_evidence` remained candidate-only with `rel_r1_nationwide_smoke` as its predecessor, three ACS definitions, 1,311 observations, seven domain digests, and a valid nationwide gate.
- The observations cover 437 House geographies × three variables.
- Census controlled-MOE sentinels remain explicit `not_applicable` facts rather than fabricated zero-width intervals. The corrected retained-source staging contains 14 such population MOEs and none in the other two indicators.
- Each indicator has `partial` coverage: 441 expected, 437 observed, zero quarantined, and four incompatible.
- The exact incompatible CD119 GEOIDs are `6098`, `6698`, `6998`, and `7898` (American Samoa, Guam, Northern Mariana Islands, and U.S. Virgin Islands). Puerto Rico `7298` is present in the official tables. Incompatible profiles expose this state explicitly, carry all three coverage records, and close to the three approved ACS snapshots without inventing observations.
- Exactly three ACS runs reached `loaded`; every definition, observation, coverage record, and profile source reference closes to its corresponding approved snapshot.
- The published R1 remained unchanged, and the R2 candidate was never promoted.

An earlier exploratory run against `rel_r2_member_facts` exposed official-header and Census pseudo-district handling defects. That disposable candidate contained obsolete parser-v1 operational metadata and is not evidence for this result.

## Verification

A clean database migrated immutable migrations `0000`–`0002` and passed 351 tests, including the guarded PostgreSQL ACS staging/finalization scenario. The scenario proves validated staging immutability, raw and lock-entry mismatch rollback, atomic persistence, restart idempotency, concurrent shared-lock verification, exact coverage, Task 6 continuity, ordinary and incompatible profile source closure, and unchanged list pages, cursors, and facets. Typecheck, ESLint, production build, the 94-entry source lock, dependency audit, Compose validation, Drizzle no-drift generation, and whitespace checks also passed.
