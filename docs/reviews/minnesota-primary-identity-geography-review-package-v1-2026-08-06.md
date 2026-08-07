# Minnesota primary identity/geography review package v1

Date: 2026-08-06
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

The package joins all eight committed Minnesota identity and geography observations one-to-one. Five records contain both an exact same-district name identity candidate and a geography candidate. The 2022 MN-02, 2022 MN-03, and 2024 MN-03 records retain geography candidates while their identity state remains explicitly source-unobserved: no contest or candidate row is present in the retained Minnesota result corpus.

The five reported records preserve raw party code `DFL` and the receipt's narrow evidence boundary: `official_portal_reported_result_not_claimed_as_certified_result_bytes`, `event_metadata_only_exact_report_bytes_not_retained`, and `not_marked_by_source`. The package does not infer a winner, nominee, uncontested contest, or certified candidate result. In particular, the one-candidate 2024 MN-04 source row remains unmarked by the source and produces no winner or nomination conclusion.

The three source-unobserved records preserve null contest IDs, contest hashes, candidate details, result authority, and certification. Their source-winner state is `not_applicable_no_reported_contest`. Geography evidence does not turn source absence into zero votes, no primary, an uncontested contest, a predecessor relationship, a nomination, or any candidate identity evidence.

Five decisions remain independent and unresolved:

1. Review portal-reported result authority for the five reported records without claiming retained exact canvass bytes, candidate certification, a winner, or a nominee.
2. Review all eight bounded geography candidates without claiming raw geometry equality, overlap, or population equivalence.
3. Review only the five exact same-district name identity candidates; preserve the three source-unobserved rows.
4. Preserve reported/source-unobserved disposition distinctions across all eight records.
5. Preserve progressive-classification and evaluator exclusion until separate evidence and review exist.

Every package and decision review remains proposed with null reviewer, timestamp, and resolution. Every identity, geography, and joint approval is false; every row is score-ineligible; publication eligibility is false. The reversible default is exclusion from evaluator and publication.

Artifact SHA-256: `560a9bc4bae7ddb35eab1ba1f66e8da3811493dedcb2f8b175ad6fac8dd76880`
Package SHA-256: `7fcec72547e0b063bdd53937d7038551f705989d7a043ee342201ba592f4cc75`
Source-set SHA-256: `861a13ea5139b92382c4961e6819ffbc82cbc266b05cee979cfd8249f23e87fa`
Parent-projection SHA-256: `0184b77ee43e61213308094d5d850e528b299eb324a9eb5fc9a01ec728794165`
Review-record-set SHA-256: `a5a3915e67bd909facf11846af3247d020177891ca6da3aabe0f3ab2be001316`
Decision-set SHA-256: `fd6e6f5957c4d02c423d9b914e0ebc26f050038827a7f15a090df44994df6b9b`

The output is a source-locked `review_proposal` with exactly three direct parents, in order: the source-selection proposal, Minnesota identity candidate, and Minnesota geography candidate. Minnesota result, current-identity, Census, and TIGER sources remain inherited through the semantically validated parent lineage.

## Reproduction

```bash
npm run generate:mn-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/minnesota-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
```
