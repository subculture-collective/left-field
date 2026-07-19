# Phase 1 R1 release evidence

Date: 2026-07-19

Environment: disposable local PostgreSQL/PostGIS database `dsa_seats_test` and Next.js development server on port 3001. This is release-train evidence, not a production deployment or production benchmark.

## D1 direct-read deployment against v1

The database was reset to the existing published v1 release `rel_phase0_20260701` before starting the database-backed application.

Verified:

- `/` returned HTTP 200 from the direct SQL repository.
- `/sources` returned HTTP 200.
- `/methodology` returned HTTP 200.
- `/seats/seat_house_al_02_2024_regular` returned HTTP 200.
- `/lookup` returned HTTP 200 and remained informational/disabled.
- While v1 remained active, an explicitly release-pinned repository read of candidate `rel_r1_nationwide_smoke` returned 50 of 541 seats, a next cursor, and `DC-AL`; the active release remained v1.

## R1 candidate construction

The retained, source-locked Task 4 identity and TIGER adapters staged validated runs into candidate `rel_r1_nationwide_smoke`. Atomic finalization completed in approximately 14 seconds and produced the content-bound nationwide validation gate. No candidate content was published before D1 verification.

## R1 promotion smoke

After version-aware validation, `rel_r1_nationwide_smoke` became the sole published release.

Verified:

- `/` returned HTTP 200 and reported the 541-seat catalog.
- `/sources` and `/methodology` returned HTTP 200.
- House/delegate profiles for DC and Puerto Rico returned HTTP 200.
- The Alabama class-2 Senate profile returned HTTP 200.
- `/lookup` remained disabled.

## Rollback and roll-forward

1. Rolled back R1 to direct predecessor `rel_phase0_20260701`.
2. Rechecked v1 browse, AL-02 profile, and sources routes; all returned HTTP 200.
3. Used the chain-checked retired-successor operation to roll forward `rel_r1_nationwide_smoke` without rebuilding it.
4. Rechecked the 541-seat browse, DC profile, and sources routes; all returned HTTP 200.

The final local state leaves `rel_r1_nationwide_smoke` published and `rel_phase0_20260701` retired. Publication history fields were preserved.

The bidirectional smoke was repeated after the final cursor collation, UTC cutoff, and profile-closure corrections; v1 and v2 browse routes again returned HTTP 200 in their respective published states.

## Query-shape evidence

Synthetic production-shaped SQL evidence is recorded in `docs/reviews/phase-1-r1-query-plans.json`: 541 catalog seats, 100,000 ACS observations, 100,000 lineage rows, all list sorts/directions, cursor continuation, filters/search, and a dense profile/closure. It includes the PostgreSQL version, sanitized inspectable plan-node summaries, hashes, and explicit list output/join bounds. The artifact is query-shape and local latency evidence only; it is not a production benchmark or factual-data validation.

## Remaining launch boundary

R1 is a nationwide identity/geography skeleton. Member biography, ACS, finance, election context, maps, corrections, and approved shared address lookup are later release-train tasks. Public MVP acceptance remains blocked until those tasks and the deployment-specific address privacy gate are complete.
