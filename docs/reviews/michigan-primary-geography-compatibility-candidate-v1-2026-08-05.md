# Michigan primary geography compatibility candidate v1

Date: 2026-08-05
Status: proposed reviewer-only geography evidence; not approved, score-bearing, published, or deployed

## Result

The candidate binds all 12 current-target identity observations for Michigan districts 03, 06, 08, 11, 12, and 13 across the retained 2022 and 2024 Democratic U.S. House primary cycles.

| Cycle | Rows | Proposed evidence |
| --- | ---: | --- |
| 2022 | 6 | Census identifies only Alabama, Georgia, Louisiana, New York, and North Carolina as CD119 redraw states; Michigan is absent, and each target state-district GEOID is present in both official CD118 and CD119 inventories. |
| 2024 | 6 | The result and target use the same CD119 session and exact Michigan state-district GEOID. |

All 12 rows are high-confidence compatibility candidates. None is automatically approved. The method does not compare raw shapes, calculate overlap, or assert population equivalence.

## Identity and election boundaries

Each geography row binds the exact identity observation and row hash plus its exact receipt contest and contest hash. Eleven parent identity rows are proposed links. `mi:identity:2022:08` remains `reported_contest_no_unique_candidate_match`: the geography evidence supports the MI-08 district key, but does not create a relationship between 2022 candidate Daniel T. Kildee and current incumbent Kristen McDonald Rivet.

All source winners remain unmarked. The candidate does not infer a winner from vote rank, select a nominee, approve identity or geography, change contest disposition, or create evaluator values. Michigan's unofficial August 5, 2026 observation contributes zero rows; no CD119-to-CD120 substitution is made.

## Immutable identities

- Artifact: `data/metadata/michigan-primary-geography-compatibility-candidate-v1.json`
- Byte size: `23,360`
- File SHA-256: `fc446b4ae756064ec52b2541ea9fd2b6338b975dcc116c47c62a11a657fc6889`
- Parent-projection SHA-256: `c8da3c7b28eec356a4decf91327d4ed123f3da6ba40def64c49f35daf9d77b03`
- Row-set SHA-256: `2a13fcc368fe0a87d13ef69a4d83895d05c23d0d5c26b02cc9e224d027915286`
- Package SHA-256: `03df08a285b893bc8e6f616f05cb446d02739485e671cf05dfe8873495f9d495`

The six direct parents are the unresolved source-selection proposal, Michigan result receipt, Michigan identity candidate, Census CD119 plan-change authority, and official Michigan CD118 and CD119 TIGER archives.

## Lifecycle boundary

Every row remains `compatibilityApproved: false`, `identityApproved: false`, `scoreEligible: false`, reviewer-only, unpublished, and undeployed. The package informs but does not resolve `approve-historical-district-cd119-compatibility-v1`. Its three inherited Michigan gates remain unresolved verbatim.

## Reproduction

```bash
npm run generate:mi-primary-geography-v1
npm run test:run -- src/ingestion/elections/michigan-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
