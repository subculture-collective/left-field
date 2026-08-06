# Maryland primary geography compatibility candidate v1

Status: proposed reviewer-only geography evidence; not approved, score-bearing, published, or deployed

## Result

The candidate binds all 14 current-target identity observations for Maryland districts 02 through 08 across the retained 2022 and 2024 Democratic U.S. House primary cycles.

| Cycle | Rows | Proposed evidence |
| --- | ---: | --- |
| 2022 | 7 | Census identifies only Alabama, Georgia, Louisiana, New York, and North Carolina as CD119 redraw states; Maryland is absent, and each target state-district GEOID is present in both official CD118 and CD119 inventories. |
| 2024 | 7 | The result and target use the same CD119 session and exact Maryland state-district GEOID. |

All 14 rows are high-confidence compatibility candidates. None is automatically approved. The method does not compare raw shapes, calculate overlap, or assert population equivalence.

## Identity and election boundaries

Each geography row binds the exact identity observation and row hash plus its exact receipt contest and contest hash. Eleven parent identity rows are proposed links. The 2022 MD-02, MD-03, and MD-06 rows remain `reported_contest_no_unique_candidate_match`: geography evidence supports those district keys but does not cross-link the predecessor candidates to current incumbents.

Source winner markers remain source facts only. The candidate does not use them to infer identity approval, select a nominee, approve geography, change contest disposition, or create evaluator values. No 2026 row is retained or inferred.

## Immutable identities

- Artifact byte size: `26,295`
- File SHA-256: `9b4dd1d3d9a39ec8cb12d3817953a7dedaf146a73fac74541d489544338ecf1e`
- Parent-projection SHA-256: `05ef50a743f2f265faf83a4694dbc5331258baa0a70126cf7889585e4d9774dd`
- Row-set SHA-256: `fec32c7a0508946cf9f33b2ad301e94062fec5aa6c56a868e96ae47737aa9d4b`
- Package SHA-256: `64d0751b3dedd67871b459660ae459a4402443500b9af2a0b5bc6f458a392ea0`

The six direct parents are the unresolved source-selection proposal, Maryland result receipt, Maryland identity candidate, Census CD119 plan-change authority, and official Maryland CD118 and CD119 TIGER archives.

## Lifecycle boundary

Every row remains `compatibilityApproved: false`, `identityApproved: false`, `scoreEligible: false`, reviewer-only, unpublished, and undeployed. The package informs but does not resolve `approve-historical-district-cd119-compatibility-v1`. Its five inherited Maryland gates remain unresolved verbatim.

## Reproduction

```bash
npm run generate:md-primary-geography-v1
npx vitest run src/ingestion/elections/maryland-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
