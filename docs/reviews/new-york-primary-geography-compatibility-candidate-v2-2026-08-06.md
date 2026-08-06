# New York primary geography compatibility candidate v2

## Outcome

This reviewer-only composition preserves the immutable 38-row New York geography v1 package and binds its 19 historical rows to the separately source-locked 2022 block crosswalk. It changes only the proposed geography evidence state:

| Cycle and disposition | Rows | Districts |
|---|---:|---|
| 2022 exact 2020-block-membership candidates | 4 | 04, 05, 12, 13 |
| 2022 split crosswalk review required | 15 | 03, 06, 07, 08, 09, 10, 14, 15, 16, 18, 19, 20, 22, 25, 26 |
| 2024 exact CD119 session/key candidates | 19 | all in-scope target districts |

Every 2022 row contains its exact crosswalk row hash, source and target plan identifiers, block counts, source-retention and target-coverage ppm, and complete source-to-target split vector. Every 2024 row has null historical-crosswalk evidence. The four historical candidates require identical source and target 2020 Census block sets; no district-number or overlap threshold can promote a split row.

The package preserves the parent’s 12 proposed identity links, four predecessor no-matches, 22 nonreported identity states, and every contest/result/authority field. Block counts remain explicitly non-population, non-voter, and non-electoral weights. Raw geometry equality, population equivalence, legal effect, election use, source winner, nomination, and result selection are not inferred.

## Review boundary

The recommended reversible decision is to retain the nineteen 2024 session/key candidates and the four 2022 identical-membership findings as candidates while leaving fifteen split rows crosswalk-review-required. The package does not make that decision: reviewer, resolution, and timestamp remain null. All 38 rows remain identity- and geography-unapproved, score-ineligible, excluded from the evaluator, unpublished, and undeployed.

The artifact has exactly two direct parents: geography v1 and the 2022 block-crosswalk candidate. Geography v1 remains retained and unsuperseded.

## Integrity and reproduction

- Artifact bytes: 90,500
- File SHA-256: `d2403c86107b131aa073c3aa26f267f50aad57b88122c517ac633413e93ab018`
- Package SHA-256: `d11566b0db64f439856798e3270ac444ef514920f948d3cfd3b1e717232445bc`
- Row-set SHA-256: `bfaf99c4dc4297927ba1141b3ae1bfd4545d3d47639f56734b427fc3c965c5ce`

```bash
npm run generate:ny-primary-geography-v2
npx vitest run src/ingestion/elections/new-york-primary-geography-compatibility-candidate-v2.test.ts
npm run data:verify
```
