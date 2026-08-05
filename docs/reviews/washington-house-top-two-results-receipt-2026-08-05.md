# Washington House top-two results receipt — 2026-08-05

## Status

This reviewer-only receipt retains official Washington Secretary of State federal-results exports for the August 2, 2022, and August 6, 2024, primaries. It is factual raw result evidence, but it is not a Democratic-primary metric and is not publication- or score-eligible.

Washington uses one top-two ballot on which a candidate's stated party preference does not establish party nomination or endorsement. The receipt therefore fixes `nominationSystem: top_two` and `formulaApplicability: confirmed_incompatible`. It preserves the official party-preference strings without converting them into Democratic nomination results.

The retained signed statewide canvasses certify the August 2, 2022, and August 6, 2024, primary returns under RCW 29A.60.240. Visual review of all seven 2022 pages and all eleven 2024 pages confirms that they enumerate the ten U.S. House contests and the same candidate totals as the CSVs. The 2022 certificate is signed and sealed August 19, 2022; the 2024 certificate is signed and sealed August 22, 2024. The receipt therefore records `certified` raw results.

## Exact sources

| Cycle | Bytes | SHA-256 | House contests | Candidate rows | Reconciled votes |
| --- | ---: | --- | ---: | ---: | ---: |
| 2022 | 10,929 | `e6be25e87a37cf1e577c2678cd172083d860d25b7b9480ea0bd09ca73c72bfa8` | 10 | 78 | 1,910,662 |
| 2024 | 9,671 | `244c1ebb89a9211e254e1115aacfe814f502b96a97552dff7791942c2eff8135` | 10 | 72 | 1,944,756 |

Certification authorities:

- 2022 signed canvass: 932,092 bytes, seven pages, SHA-256 `070d6f790c4ce5b279658d18d89bc7236d20fca8b0288dac034177aede5614fe`.
- 2024 signed canvass: 1,376,836 bytes, eleven pages, SHA-256 `f75e558434a6633786614cc3b2696916bf81d651c79d4a0868104ca8546849ac`.

The Secretary of State site served both canvasses to an ordinary interactive browser over verified TLS but returned HTTP 403 to the command-line client used for the CSV fetcher. The retained PDFs are therefore browser-captured source artifacts rather than outputs of `fetch:wa-house-primary-results`; their exact bytes, sizes, hashes, PDF headers, and fixed certification tuples are enforced by the source lock, generator, and tests. No TLS verification was disabled.

Every contest includes every source candidate row and a write-in row. Candidate votes are nonnegative integers; contest totals are recomputed; each supplied percentage must agree with the recomputed vote share within the source's two-decimal rounding tolerance.

## Receipt boundary

- Receipt file: `data/metadata/washington-house-top-two-results-receipt-20220802-20240806-v1.json`
- File size: 50,640 bytes
- File SHA-256: `eac5df760de11a6612c2e8a95374a8041b2debb94068e0d08afadecd775963da`
- Package SHA-256: `a930a28888f3892f0b4459063b0d0a2c195bfada26960b705757124a403e5e13`
- Contest-set SHA-256: `30fbbe0795413030a49fb366375c9898e97e7f778a5441e9785fcddd36b2a259`
- Cycles: 2
- House contests: 20
- Candidate rows: 150
- Evaluator numeric values: 0
- Score-eligible contests: 0

Candidate-to-BioGuide identity, current-incumbent participation, progressive classification, and historical-district compatibility remain unresolved. Party preference, name similarity, or current House service cannot close those gates. The current primary source-selection proposal remains an excluded methodology parent rather than an approval mechanism.

## Reproduction

```bash
npm run fetch:wa-house-primary-results
# The two retained certification PDFs are source inputs; the command above fetches only the CSV exports.
npm run generate:wa-house-top-two-results-receipt
npm run test:run -- src/ingestion/elections/washington-house-top-two-results-receipt.test.ts
npm run data:verify
```
