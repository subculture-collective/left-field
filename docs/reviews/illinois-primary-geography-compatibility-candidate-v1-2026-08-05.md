# Illinois primary geography compatibility candidate v1

Date: 2026-08-05
Status: proposed reviewer-only geography evidence; not approved, score-bearing, published, or deployed

## Result

The candidate accounts for every retained Illinois U.S. House Democratic primary contest: districts 01–17 in both 2022 and 2024, for 34 rows total. This includes district 16 in both cycles, where the primary-results receipt retains an explicit no-Democratic-candidate-row disposition; geography coverage does not convert that disposition into a candidate observation, zero, or score.

| Cycle | Evidence | Rows | Disposition |
| --- | --- | ---: | --- |
| 2022 | Official Census CD119 redraw declaration excludes Illinois; exact CD118 and CD119 numbered inventories both contain GEOIDs 1701–1717 | 17 | `official_no_plan_change_declaration_same_geoid_key_candidate` |
| 2024 | Contest and target geography both use the 119th Congress; exact CD119 numbered inventory contains GEOIDs 1701–1717 | 17 | `same_cd119_session_and_geoid_exact_key_candidate` |

Each DBF contains exactly 18 live records: numbered districts 01–17 and one `ZZ` undefined-district sentinel with GEOID `17ZZ`. The builder requires exactly one sentinel in each session's DBF, accounts for it separately, and excludes it from the 34 contest observations.

Every emitted row is a high-confidence compatibility candidate, not an approval. The method does not compare raw shape coordinates, calculate overlap, or establish population equivalence. Matching district numbers alone are not the evidence; the candidate requires the exact Census authority statement and complete official CD118/CD119 numbered inventories.

## Lifecycle boundary

The artifact informs the unresolved `approve-historical-district-cd119-compatibility-v1` decision and does not resolve it. It inherits all four unresolved gates from the Illinois primary-results receipt without narrowing or closing them:

- `retain_final_state_canvass_or_certification`
- `review_incumbent_candidate_identity`
- `review_historical_district_compatibility`
- `review_progressive_candidate_classification`

Final statewide canvass or certification evidence is not retained, so every row preserves `certificationStatus: "not_retained"`. Every row also has `compatibilityApproved: false`, `identityApproved: false`, and `scoreEligible: false`. Evaluator use remains excluded pending certification, identity, historical-geography, and progressive-classification review.

The package emits no 2026/CD120 row and makes no CD119-continuity assumption for a future election. It creates no approval, evaluator value, score, publication state, or deployment state.

## Immutable identities

- Artifact: `data/metadata/illinois-primary-geography-compatibility-candidate-v1.json`
- Byte size: `42,526`
- File SHA-256: `258c70fe0b9a7962dea8865df20e19b5874dd73542fa09bcb37ab2d49887665d`
- Parent-projection SHA-256: `2b7f5f221c72850492fe0892778fde2c8b740ddab5b019dae36351f4a012c4ad`
- Row-set SHA-256: `86cc65b2f8b8158d4c15a091e14723bd6724224c34f5057b5e04ff4e2fe71421`
- Package SHA-256: `ff38dcc70c8390f9bdb0a6ec04f05b0e1d187690bcde5c6af5a5a83b3bc73819`

The builder recomputes hashes over the authority HTML, both raw TIGER ZIPs, and both explicitly named extracted DBFs. It validates the exact source-lock lineage, all four inherited gates, and complete numbered-plus-sentinel inventories. The validator pins all 34 parent contest ID/hash pairs through the parent-projection digest, as well as evidence categories, row hashes, the row-set hash, and the package hash; it rejects unknown fields and fully rehashed semantic substitution.

## Reproduction

```bash
npm run generate:il-primary-geography-v1
npm run test:run -- src/ingestion/elections/illinois-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
