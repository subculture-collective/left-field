# Arizona primary geography compatibility candidate v1

Date: 2026-08-06  
Status: proposed reviewer-only geography evidence; not approved, score-bearing, published, or deployed

## Result

The candidate binds all six current-target identity observations for Arizona districts 03, 04, and 07 across the retained 2022 and 2024 Democratic U.S. House primary cycles.

| Cycle | Rows | Proposed evidence |
| --- | ---: | --- |
| 2022 | 3 | Census identifies only Alabama, Georgia, Louisiana, New York, and North Carolina as CD119 redraw states; Arizona is absent, and each target state-district GEOID is present in both official CD118 and CD119 inventories. |
| 2024 | 3 | The result and target use the same CD119 session and exact Arizona state-district GEOID. |

All six rows are high-confidence compatibility candidates. None is automatically approved. The method does not compare raw shapes, calculate overlap, or assert population equivalence.

## Identity and election boundaries

Each geography row binds the exact identity observation and row hash plus its exact receipt contest and contest hash. Three parent identity rows are proposed exact-name links. Three remain `reported_contest_no_unique_candidate_match`: the geography evidence supports their district keys but does not create relationships from Ruben Gallego to Yassamin Ansari or from Raúl/Raúl M. Grijalva to Adelita S. Grijalva.

All source winner markers remain direct source facts. The candidate does not convert those markers into identity evidence, review approval, evaluator selection, progressive classification, or score eligibility. The 2024 district 03 row retains its final-recount/court-order authority, while the other five retain official statewide-canvass authority. Arizona's unofficial August 5, 2026 boundary contributes zero rows; no CD119-to-CD120 substitution is made.

## Immutable identities

- Artifact: `data/metadata/arizona-primary-geography-compatibility-candidate-v1.json`
- Byte size: `14,465`
- File SHA-256: `adfa36d809512c5f3973c72992dbad39cb4b8031f7cc79d5f8fe177c8e9c02e0`
- Parent-projection SHA-256: `e84ff45fcba79a5b8a71ee547773f4b64fc7584c3029538faa47c64270439c53`
- Row-set SHA-256: `dbd5787cd646ad09e7aa34f6deed614795c7972c6ef970c6ad3badcb46b46271`
- Package SHA-256: `56ca8382bb1a13591a5cf2ae8d25d0a1b069744cfdd8ccc6a643d0be9a64c2a2`

The six direct parents are the unresolved source-selection proposal, Arizona result receipt, Arizona identity candidate, Census CD119 plan-change authority, and official Arizona CD118 and CD119 TIGER archives.

## Lifecycle boundary

Every row remains `compatibilityApproved: false`, `identityApproved: false`, `scoreEligible: false`, reviewer-only, unpublished, and undeployed. The package informs but does not resolve `approve-historical-district-cd119-compatibility-v1`. All inherited Arizona gates remain unresolved verbatim.

## Reproduction

```bash
npm run generate:az-primary-geography-v1
npm run test:run -- src/ingestion/elections/arizona-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
