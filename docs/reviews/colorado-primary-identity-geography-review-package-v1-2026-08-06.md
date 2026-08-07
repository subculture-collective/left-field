# Colorado primary identity/geography review package v1

Date: 2026-08-06
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

The package joins all 12 committed Colorado identity and geography observations one-to-one for CO-01, CO-02, CO-06, and CO-07 across 2022, 2024, and 2026. Eight 2022/2024 records contain both an exact same-district name identity candidate and a bounded geography candidate. The four 2026 records retain their exact identity candidates while historical geography remains explicitly pending CD120 authority.

The 2026 records preserve `historicalCongressSession: "120"`, null historical GEOIDs, `unassessed_cd120_authority_collection_pending`, `authority_pending`, `none` confidence, and geography-candidate false. The package does not infer CD119 continuity for the 2026 election merely because the current identity is strongly supported or the district number is unchanged.

All records preserve the result receipt's cycle-specific authority boundary:

- 2022: official Secretary abstract plus the retained certification announcement and signed statewide abstract.
- 2024: official certified Biennial Abstract with no separately retained signed certificate.
- 2026: signed Secretary statewide abstract bound to the signed Secretary certificate.

Every source-winner state remains `not_marked_by_source`; nomination and result conclusions remain null. Vote rank creates no winner, nominee, uncontested, or candidate-by-candidate certification claim.

Five decisions remain independent and unresolved:

1. Review all 12 cycle-specific official-result authority records without creating winner, nomination, result, or candidate-certification claims.
2. Review the eight 2022/2024 geography candidates while preserving the four 2026/CD120 rows as authority-pending.
3. Review all 12 exact same-district name identity candidates without claiming a direct person-identifier bridge.
4. Preserve the unmarked source-winner and null-disposition boundary across all 12 records.
5. Preserve progressive-classification and evaluator exclusion until separate evidence and review exist.

Every package and decision review remains proposed with null reviewer, timestamp, and resolution. Every identity, geography, and joint approval is false; every row is score-ineligible; publication eligibility is false. The reversible default is exclusion from evaluator and publication.

Artifact SHA-256: `f920f5b690b503f4210e6695bc4ebeac366818e565d538080d5463490351876f`
Package SHA-256: `af02da688e774bf121c5077b16b59fbee020ceaed6fdee1f37bc8c73542b0f77`
Source-set SHA-256: `48de0d1f44f6dae4a36d25c8cc5bef6cdfca96a1f449300e8d53789e2d02a122`
Review-record-set SHA-256: `cfb14cc39f52673300b03128ec74655f0cd90fba1f3d3330e7aab27ff25764f4`
Decision-set SHA-256: `807dc9071e43772b6cc204a81db4024fbc21c3eae04fd2f4c40eee839e34181a`

The output is a source-locked `review_proposal` with exactly three direct parents, in order: the source-selection proposal, Colorado identity candidate, and Colorado geography candidate. Colorado result, current-identity, Census, and TIGER sources remain inherited through the semantically validated parent lineage.

## Reproduction

```bash
npm run generate:co-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/colorado-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
```
