# New York metro county primary authority and disposition candidate v3 — 2026-08-06

## Outcome and reviewer boundary

This source-locked, reviewer-only slice resolves one of the 18 district-years that remained outside retained New York state and New York City authority. Official Suffolk County Board of Elections final-result pages report the complete 2024 Democratic primary for U.S. House district 01. The composed v3 disposition matrix therefore changes exactly `ny:2024:us-house:01:democratic` from unresolved to `reported_contest` and preserves the other 51 v2 rows.

This is a proposed factual candidate, not reviewer approval or publication. It creates no evaluator value or score. The Suffolk result does not identify a source winner, and the retained pages do not include a separately signed certification instrument.

## Retained authority

- The official Suffolk election-results index labels the linked June 25, 2024 primary pages **Final Results**.
- The district 01 Democratic result reports all 561 of 561 election districts and 27,636 votes: John P Avlon 19,383 and Nancy S Goroff 8,253.
- The retained Census CD119 Block Equivalency File independently assigns all 13,001 New York district 01 blocks to county FIPS `103`. A separately retained official Census New York county-code table binds GEOID `36103` and county code `103` to Suffolk County. The Suffolk result therefore covers the whole district rather than an incomplete county fragment.
- Candidate votes reconcile exactly to the reported 27,636 votes cast.

The county receipt records `county_board_final_results_candidate`, `signed_certification_not_separately_retained`, and `single_county_whole_district`. It retains the Suffolk source contest ID separately; v3 does not overwrite the null statewide `reportedContestId` or copy vote totals into evaluator fields.

## Exact v3 composition

| Cycle | Reported | State-certified uncontested | Unresolved |
| --- | ---: | ---: | ---: |
| 2022 | 15 | 4 | 7 |
| 2024 | 5 | 11 | 10 |
| **Total** | **20** | **15** | **17** |

- Seat-cycle rows: **52**
- Existing NYC authority objects preserved: **8**
- New complete-county authority overrides: **1**
- Vote values, evaluator numeric values, and score-eligible rows: **0**
- County authority row-set SHA-256: `f2429615d10058819853637b63b1c7deceddbfc8068569dde8f68d813545189d`
- County authority package SHA-256: `9907f4f9a2e7ae4c3ad7efb2127901787a720f7eff51f83023b1d00b7fae12ea`
- v3 disposition-set SHA-256: `ddafdf0d0a161b67087041b1c678c820dda07ce3f983d05ad283a6ccb06fd544`
- v3 package SHA-256: `33c46131067fda45ed9b05318e59fedaf3ab73d350721acabab29768f0c32f8d`
- v3 file SHA-256: `852d69fab2b51dc12bb2c84cf3f8ca1103b6cd3be7f4b19d4094e01c1aeb8098`

Validation binds v3 to the exact v2 and county-receipt package hashes, preserves every parent ballot, state-result, and NYC-authority field, and rejects rehashed attempts to collapse the county contest into the statewide identifier or make any row score eligible.

## Remaining gates

1. Retain authoritative ballot and result evidence for the other 17 unresolved district-years.
2. Retain or review a separately signed Suffolk certification instrument if one becomes available.
3. Review current-incumbent identity, historical geography, and progressive classification.
4. Complete human data review and explicit publication approval.

Missing or inaccessible result pages remain unresolved; they are never interpreted as uncontested, no-primary, no-candidate, or zero votes.

## Reproduction

```bash
NY_METRO_PRIMARY_IMPORT_DIR=/path/to/exact-browser-export npm run import:ny-metro-primary-county-authority
npm run generate:ny-metro-primary-county-authority-v1
npm run generate:ny-house-primary-dispositions-v3
npx vitest run src/ingestion/elections/new-york-metro-primary-county-authority-receipt.test.ts src/ingestion/elections/new-york-house-democratic-primary-dispositions-v3-receipt.test.ts
npm run data:verify
npm run typecheck
```
