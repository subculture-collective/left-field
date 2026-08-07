# Ohio primary identity/geography review package v1

Date: 2026-08-06
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

The package joins all ten committed Ohio identity and geography observations one-to-one for OH-01, OH-03, OH-09, OH-11, and OH-13 across the closed 2024 and 2026 statewide result cycles. Five 2024 records contain both an identity candidate and an exact CD119 session/key geography candidate. The five 2026 records retain their identity candidates while historical geography remains explicitly pending CD120 authority.

The identity partition remains eight exact normalized observations and two documented `Emilia Sykes` to `Emilia Strong Sykes` middle-name-omission relationships. The join does not relabel those two derived relationships as exact and claims no direct person-identifier bridge.

The 2026 records preserve `historicalCongressSession: "120"`, null historical GEOIDs, `unassessed_cd120_authority_collection_pending`, `authority_pending`, `none` confidence, and geography-candidate false. The package does not infer CD119 continuity for 2026 from unchanged district numbers, the retained CD119 Census context, or strong current-identity evidence. It performs no raw-geometry equality, overlap, or population-equivalence analysis.

All ten records preserve `secretary_official_canvass_workbook`, `official_canvass_workbook_separate_certificate_not_retained`, and `sourceWinnerStatus: not_marked_by_source`. Nomination and result conclusions remain null. Vote rank and one-candidate contests create no winner, nominee, uncontested, or candidate-by-candidate certification claim.

The twelve retained partial 2022 county segments create zero district review records and zero CD118-to-CD119 continuity candidates. Their 192,826 votes remain acquisition evidence only; no county segment becomes a district contest, identity observation, geography observation, zero, winner, nomination, or inferred district closure.

Five decisions remain independent and unresolved:

1. Review all ten official-canvass authority records without creating winner, nomination, result, or candidate-certification conclusions.
2. Review the five 2024 CD119 key candidates while retaining the five 2026/CD120 rows as authority-pending.
3. Review eight exact and two documented derived identity candidates without claiming a direct identifier bridge.
4. Preserve the unmarked source-winner and null-disposition boundary across all ten records.
5. Preserve progressive-classification and evaluator exclusion until separate evidence and review exist.

Every package and decision review remains proposed with null reviewer, timestamp, and resolution. Every identity, geography, and joint approval is false; every row is score-ineligible; publication eligibility is false. The reversible default is exclusion from evaluator and publication.

Artifact SHA-256: `209ef0716bbc7dcdb3658f4ad7fbb29d684ec5566099fe0a23847f5fefe95da6`
Package SHA-256: `948275112e8e6264712e1a3009b435df30dadd7c68ee7c342286716c2f7bb73e`
Source-set SHA-256: `9bb748bf22e4a17522340bda9b87e1ad7187e643de8ae78d94b72b31e0a4392e`
Review-record-set SHA-256: `49974b55c218bf7b8c09b9ab762ec6b7dec58ca106ec4a4dbf5da78b9b8063e3`
Decision-set SHA-256: `273b432f54004f3b8ad8d08f61ca081b830c1c293767403f2ccb5a24ae6623d3`

The output is a source-locked `review_proposal` with exactly three direct parents, in order: the source-selection proposal, Ohio identity candidate, and Ohio geography candidate. The Ohio result receipt, roster, House XML, Congress Legislators snapshot, Census authority, TIGER layer, and county sources remain inherited through the semantically validated parent lineage.

## Reproduction

```bash
npm run generate:oh-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/ohio-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
```
