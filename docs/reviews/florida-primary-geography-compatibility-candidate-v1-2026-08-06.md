# Florida primary geography compatibility candidate v1

Date: 2026-08-06  
Status: proposed reviewer evidence; no approval, evaluator value, publication, or deployment

## Scope and conclusion

This hash-bound candidate joins all 14 Florida current-target identity observations one-to-one with geography evidence for districts 09, 10, 14, 22, 23, 24, and 25 across 2022 and 2024.

| Cycle | Rows | Proposed evidence |
| --- | ---: | --- |
| 2022 | 7 | Census identifies only Alabama, Georgia, Louisiana, New York, and North Carolina as CD119 redraw states; Florida is absent, and every target GEOID exists in both the official CD118 and CD119 inventories. |
| 2024 | 7 | The result and target use the same CD119 session and exact Florida state-district GEOID. |

These are compatibility candidates, not approvals. Raw TIGER geometry equality, overlap, and population equivalence were not assessed.

## Identity and result boundary

Seven rows retain proposed identity links. Seven retain `source_unobserved_district_cycle_unresolved`: 2022 FL-09/22 and 2024 FL-09/14/22/23/24. Geography evidence does not manufacture contests for those rows; their contest ID, contest hash, result authority, and certification remain null, and their source-winner state remains not applicable. The seven reported rows preserve the Division official-extract and no-separate-signed-certificate boundary plus `not_marked_by_source`.

All 14 rows remain `compatibilityApproved: false`, `identityApproved: false`, and `scoreEligible: false`. The package informs the existing historical-compatibility decision but does not resolve it or any inherited Florida gate.

## Integrity

- Artifact SHA-256: `52ebf482c7add0a3c408557e0a0b929851dc3e8796acd5e59b978b25a330920d`
- Package SHA-256: `4f56b058d79eaa1d0fd0ea2f87c5b55e9c57126acf7a45b5707bcf19300268e8`
- Row-set SHA-256: `2e9306e84241e7609a21887d9fe6fd3e20e0d374ef760ab7ba070a0dfd2818fe`
- Parent-projection SHA-256: `cf73ea41a2d5f3a993db3dc07041723b738f7b1829b970003df89c37f8d1d6d7`

The exact six direct parents are the source-selection proposal, Florida result receipt, Florida identity candidate, Census CD119 plan-change authority, official Florida CD118 archive, and official Florida CD119 archive.

```bash
npm run generate:fl-primary-geography-v1
npm run test:run -- src/ingestion/elections/florida-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
