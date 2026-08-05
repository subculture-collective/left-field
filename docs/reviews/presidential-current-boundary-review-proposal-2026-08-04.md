# 2020 presidential current-boundary reviewer proposal — 2026-08-04

## Decision state

The 2020 current-boundary facts are retained as a complete factual candidate, but they remain proposed, nonpublishable, and excluded from every score. Two reviewer decisions are unresolved:

1. whether the publisher's 2020 calculations for district lines used in 2024 are compatible with the pinned Census CD119 geography for reviewer evaluation; and
2. whether the existing production snapshot's `publisher-publication` terms and editorial authority may be extended to this additional 2020 modeled use.

The default for both decisions is `exclude_from_scoring_and_publication`. Neither blocks continued acquisition or engineering work.

## Candidate evidence

The retained CSV is byte-identical to production snapshot `snap_full_elections`:

- URL: `https://docs.google.com/spreadsheets/d/1ng1i_Dm_RMDnEvauH44pgE6JCUsapcuu8F2pCfeLWFo/export?format=csv&gid=1491069057`
- SHA-256: `938410ae6b42104eb6ee73ff1fcb4de13f39c2aefa607c73b5664eec9ade974e`
- size: 55,833 bytes
- production retrieval: 2026-08-04T18:20:00Z
- production metadata: editorial authority, `publisher-publication`, approved usage, parser `downballot-cd-exact-csv-v1`

The candidate package contains 435 unique voting-district facts. Each retains Biden votes, Trump votes, total presidential votes, the computed Democratic-minus-Republican margin, and a domain-separated source-row hash. It excludes incumbent and candidate-name columns from the proposal.

## Closure checks

- 435/435 publisher voting-district keys exactly match the voting-district subset of pinned `geo-national-cd119`.
- 212/212 current target seats have a 2020 candidate fact.
- The same source rows' exact 2024 Harris/Trump/total calculation agrees with the published production projection for 212/212 target seats; failures: zero.
- Biden plus Trump never exceeds the reported total.
- Every margin is bounded to -100 through +100 points.
- The package is hash-bound to the retained CSV, the pinned national CD119 artifact, and factual projection `dsa-target-factual-projection-20260804-v1`.

These checks prove byte identity, row integrity, and key closure. They do not independently prove the publisher's precinct allocation method, reuse permission for the new purpose, or certified district returns. No nationwide government source publishes certified 2020 results directly on districts that took effect after the 2020 election.

## Reproduction

```bash
npm run generate:presidential-current-boundary-proposal
npm test -- --run scripts/enrich-full-factual.test.ts src/ingestion/elections/presidential-current-boundary-proposal.test.ts
npm run data:verify
```

Generation uses exclusive-create/idempotent semantics and rejects any differing existing output. Approval should create a new reviewed artifact; it must not mutate this proposed package in place.

## Stronger production path

A production-grade independent derivation would source-lock reusable 2020 precinct returns, overlay them state by state onto the fixed Census CD119 geometry, preserve allocation weights and unallocatable outcomes, and prove state-level vote conservation. Until that work or the two explicit decisions are approved, the current target report correctly keeps compatible 2020 margin `not_collected`.
