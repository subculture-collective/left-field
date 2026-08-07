# Ohio current-incumbent primary linkage candidate v1

Date: 2026-08-06
Status: proposed reviewer-only identity candidate; not approved, score-bearing, published, or deployed

## Result

The package binds the ten closed statewide Ohio target contests for 2024 and 2026 to the current incumbents of OH-01, OH-03, OH-09, OH-11, and OH-13. It proposes eight exact normalized name observations and two documented derived relationships: the source spelling `Emilia Sykes` omits the current House official middle name in `Emilia Strong Sykes` in both cycles.

The ten contests contain 14 candidate rows and 540,587 total votes. The ten linked source candidate rows contain 494,773 votes. Every contest preserves `secretary_official_canvass_workbook`, `official_canvass_workbook_separate_certificate_not_retained`, and `not_marked_by_source`. The package does not infer a winner, nominee, uncontested contest, or candidate-by-candidate certification from vote rank or a one-candidate source row.

The retained Ohio v4 receipt also contains 12 partial 2022 county segments, but it emits zero closed 2022 district contests. This identity package therefore creates zero 2022 identity observations. County-progress rows do not become district totals, candidates, zeroes, winners, nominations, or identity evidence. The unresolved controlling county-universe authority, remaining county acquisition, and finality conflicts stay isolated in the receipt.

The current roster, House Clerk XML, and Congress Legislators snapshot agree on all five BioGuide identities, official names, state, and districts. Source candidate rows contain no direct person identifier, so all ten links remain proposed. Historical geography stays separate and unapproved.

Artifact SHA-256: `b4e47cf3f5b17811f83f531637b1f916ba7dea6afceb001ee10a251593912f28`
Package SHA-256: `bbdf13d44228ca37c7076cedd0bca4dedb379b842d252f57c7c56fb8913f92b9`
Observation-set SHA-256: `a6c2acd6383975e76cfd15055b2ebc388b6c6a7d953edb634b8323cf59fbe288`

Recommended decision: accept the eight exact and two documented middle-name-omission relationships as identity candidates. Safe default: keep all ten excluded from evaluator and publication until identity and historical-geography review are explicitly resolved.

Every identity approval and score-eligibility flag is false. Review status remains proposed with null reviewer, timestamp, and resolution; publication eligibility is false.

## Reproduction

```bash
npm run generate:oh-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/ohio-current-incumbent-primary-linkage-candidate.test.ts
npm run typecheck
npm run data:verify
```
