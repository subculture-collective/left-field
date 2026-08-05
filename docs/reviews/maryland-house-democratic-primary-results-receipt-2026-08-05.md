# Maryland House Democratic primary result corpus — 2026-08-05

## Status and authority boundary

This reviewer-only candidate retains the Maryland State Board of Elections statewide Democratic congressional-breakdown CSVs for the July 19, 2022, and May 14, 2024 primaries. The official raw-data archive exposes one file per cycle, and each file contains one statewide candidate-total row for every Democratic U.S. House candidate in districts 01 through 08.

The files are official state-board result data, but this package does not retain a separate signed, sealed, or otherwise independently identified final certification artifact. Every contest therefore remains `state_board_official_result_candidate`, `certificationStatus: not_independently_retained`, reviewer-only, score-ineligible, and publication-ineligible.

## Exact corpus

- Retained source files: **2**
- District-cycle contests: **16** (8 in 2022 and 8 in 2024)
- Source candidates: **88**
- Candidate votes: **1,304,581**
- Evaluator numeric values and score-eligible contests: **0**
- Contest-set SHA-256: `320cb49e83fb3df8266ffe0ef3600264a3a934bce4f926aea4d44693ec36d6f9`
- Package SHA-256: `03876280eeb67b63462e568c243e7f015954ec48584f0c86aa0e03bc78025fae`
- File SHA-256: `0eb964436022b54e3e797bd8578687b2f0a506d8832200cdf33853fb2de2d59a`

The parser requires the exact 15-column schema and exact two-source closure. It selects only `U.S. Congress` / `DEM` statewide rows, requires districts 01–08 in each cycle, verifies that each vote appears only in its matching congressional-district column, requires unique candidate names and one source winner marker per contest, and sums every source candidate row exactly once. The source does not supply a separate contest-total row, so `candidateVotes` is the exact candidate-row sum rather than an independently supplied total reconciliation.

Source candidate names and winner markers are retained as reported. They are not current-incumbent identity bindings, progressive classifications, or proof that a same-numbered historical district is compatible with the current target geography.

## Remaining gates

1. Retain final certification authority tied to both primary result sets.
2. Review source candidates against the current target incumbent identities.
3. Review historical district compatibility with the current target geography.
4. Retain contest-effective progressive classifications where required.
5. Complete human data review and explicit publication approval.

## Reproduction

```bash
npm run fetch:md-house-primary-results
npm run generate:md-house-primary-results-receipt
npx vitest run src/ingestion/elections/maryland-house-democratic-primary-results-receipt.test.ts
npm run data:verify
npm run typecheck
```
