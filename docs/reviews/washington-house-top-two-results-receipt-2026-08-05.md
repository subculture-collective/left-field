# Washington House top-two results receipt — 2026-08-05

## Status

This reviewer-only receipt retains official Washington Secretary of State federal-results exports for the August 2, 2022, and August 6, 2024, primaries. It is factual raw result evidence, but it is not a Democratic-primary metric and is not publication- or score-eligible.

Washington uses one top-two ballot on which a candidate's stated party preference does not establish party nomination or endorsement. The receipt therefore fixes `nominationSystem: top_two` and `formulaApplicability: confirmed_incompatible`. It preserves the official party-preference strings without converting them into Democratic nomination results.

The archived export pages warn that totals may change until certification, and neither retained CSV contains a certification signature or statement. The receipt conservatively records `official_final_uncertified` until a separate official canvass/certification artifact is retained and scope-checked.

## Exact sources

| Cycle | Bytes | SHA-256 | House contests | Candidate rows | Reconciled votes |
| --- | ---: | --- | ---: | ---: | ---: |
| 2022 | 10,929 | `e6be25e87a37cf1e577c2678cd172083d860d25b7b9480ea0bd09ca73c72bfa8` | 10 | 78 | 1,910,662 |
| 2024 | 9,671 | `244c1ebb89a9211e254e1115aacfe814f502b96a97552dff7791942c2eff8135` | 10 | 72 | 1,944,756 |

Every contest includes every source candidate row and a write-in row. Candidate votes are nonnegative integers; contest totals are recomputed; each supplied percentage must agree with the recomputed vote share within the source's two-decimal rounding tolerance.

## Receipt boundary

- Receipt file: `data/metadata/washington-house-top-two-results-receipt-20220802-20240806-v1.json`
- File size: 49,694 bytes
- File SHA-256: `74c456931bda332cccc84209b3a18c746fb1c20ac857e31622973cd12cc77064`
- Package SHA-256: `1d124e8d8f2476b311f3e4a26f453f2fd99104f4f206d6088a8357888207aef4`
- Contest-set SHA-256: `81d60b663e5d06c337c8f1fd3b4a2b55447af0e3d38a9a19b797b0caf02166dd`
- Cycles: 2
- House contests: 20
- Candidate rows: 150
- Evaluator numeric values: 0
- Score-eligible contests: 0

Candidate-to-BioGuide identity, current-incumbent participation, progressive classification, and historical-district compatibility remain unresolved. Party preference, name similarity, or current House service cannot close those gates. The current primary source-selection proposal remains an excluded methodology parent rather than an approval mechanism.

## Reproduction

```bash
npm run fetch:wa-house-primary-results
npm run generate:wa-house-top-two-results-receipt
npm run test:run -- src/ingestion/elections/washington-house-top-two-results-receipt.test.ts
npm run data:verify
```
