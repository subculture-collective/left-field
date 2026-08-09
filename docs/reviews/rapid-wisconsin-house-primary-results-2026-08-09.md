# Wisconsin rapid House-primary canvass receipt

This slice retains the Wisconsin Elections Commission's official county-by-county U.S. House canvass reports for the August 9, 2022 and August 13, 2024 partisan primaries. The raw PDFs and deterministic `pdftotext -layout` 26.07.0 extracts are source-locked together.

The four current-target observations close exactly:

- 2022 WI-02: Mark Pocan 106,595; scattering 198; total 106,793.
- 2022 WI-04: Gwen Moore 72,845; scattering 325; total 73,170.
- 2024 WI-02: Mark Pocan 149,581; scattering 316; total 149,897.
- 2024 WI-04: Gwen S. Moore 85,017; scattering 411; total 85,428.

The resulting v24 rapid-primary projection contains 46 reported contests, four explicit source-absence observations, 122 candidate rows, and 3,123,464 retained candidate votes across 78 target observations. Wisconsin 2026 remains a future event.

The canvass tables do not provide a machine-readable winner marker used by this parser. Candidate rank is therefore not converted into winner identity, incumbent identity, approval, or score eligibility. The artifact says only that the official WEC canvass report bytes were retained; no separate certification instrument is claimed.

Pinned outputs:

- Wisconsin result package: 4,860 bytes; SHA-256 `cd1253719ed937165d773259b3e7609db7931f154d073f3bce179e3ff98ff0db`; package `888314a82bd1aed4d6b2f67277a886f5cad4559fea56c272259077d76a1da7d4`.
- Rapid projection v24: 64,981 bytes; SHA-256 `e3ca1e84a28aaa3d56176b7aa1a5273fc361919c4cd609e611e4826757ade68f`; package `d6f35bc5d0e66e3e77d323c56e8267cf19c843f6446df3cb0487dc199c751672`.
- Coverage ledger v24: 20,241 bytes; SHA-256 `117d7063527e32385b7d4e743645be5f2deb791ea41264dc98ff7dfb3500cc41`.

Reproduction:

```sh
npm run acquire:rapid-house-primary-wisconsin
npm run generate:rapid-house-primary-wisconsin-results
npm run generate:rapid-house-primary-projection-v24
npx vitest run src/rapid-acquisition/house-primary-wisconsin-results.test.ts src/rapid-acquisition/house-primary-projection-v24.test.ts src/ui/rapid-house-primary-coverage.test.ts
```
