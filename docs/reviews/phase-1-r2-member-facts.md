# Phase 1 R2 member-fact candidate evidence

Date: 2026-07-19

Environment: disposable local PostgreSQL/PostGIS development database. This is not production deployment evidence.

## Scope decision

Official source review found no stable nationwide source that provides both exact dates of birth and dated member-to-committee assignment intervals:

- Congress.gov provides a birth year, not a full date of birth.
- Bioguide full dates occur in per-record biography prose without a supported bulk API contract.
- House Clerk and Senate current-assignment sources do not provide authoritative assignment start and end dates.

R2 therefore remains manifest v2 and publishes only release-observed, source-locked Bioguide identity matches. It stores `birth_date` as explicitly `not_collected`, derives no age, and publishes no legislative committee assignments. Absence of an assignment row does not mean that a member has no assignments.

## Data and coverage

- Source release: `rel_r1_nationwide_smoke` (published)
- Candidate release: `rel_r2_member_facts` (validated candidate; never promoted)
- Current matched people: 537
- Matching `bioguide_id` facts: 537
- Explicit missing `birth_date` facts: 537
- Committee assignment facts: 0
- Release member identity-match coverage: 537 / 537, `complete`
- All fact provenance reuses the approved source snapshots already attached to the corresponding R1 person identity.

The member coverage denominator is current people with an active membership at the release cutoff. It is identity-match coverage, not complete biography or committee coverage.

## Operational checks

- No Task 6 migration or source adapter is retained. Congress.gov and Bioguide parsers are bounded research/preflight utilities only; they do not claim response retention, replay, staging, or publication.
- Candidate facts are derived only from the already source-locked R1 person identities. Exact persisted invariants—not adapter counts—prove identical source/target current-person sets, one matching Bioguide fact and one explicit missing birth-date fact per person, exact per-fact `(snapshot, role)` provenance equality with the corresponding R1 person, no extra/noncurrent facts, and zero legislative assignments.
- `enrichCandidateMembersFromBaseline` baselines and enriches in one transaction, recomputes canonical/content checksums, rebuilds all seven domain digests and the nationwide validation gate, and leaves the target candidate-only.
- Re-running `enrich:members` against the validated candidate is read-only and returns the same counts.
- Restart verification rechecks the content-bound nationwide gate and all Task 6 invariants under one locked database transaction; it cannot combine observations from two database snapshots.
- A release-pinned direct SQL profile for `seat_house_ak_al_current` returned Bioguide `B001323`, explicit `birth_date: not_collected`, 537/537 identity-match coverage, no committee claim, and exact source closure.

## Deferred work

A future observed-current assignment model requires a separately reviewed manifest version and migration. It must distinguish observation time from authoritative effective dates and must not reuse FEC committee semantics.
