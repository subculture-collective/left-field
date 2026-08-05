# New Jersey House Democratic primary results receipt — 2026-08-05

## Outcome

The complete New Jersey Department of State, Division of Elections U.S. House primary-result PDFs for 2022, 2024, and 2026 are retained byte-for-byte. Each corresponding year page publishes the document under `Official Primary Election Results`, and each PDF identifies itself as an `Official List` for the named primary election. Layout-preserving text extracts are separately source-locked as derived children of the PDFs and record Poppler `pdftotext` 26.07.0 with `-layout` mode.

The receipt selects only candidate headers explicitly labeled `Democratic`, joins them to the active congressional-district section, and binds each candidate to the document's candidate-level `Total`. It handles repeated candidate headers at PDF page boundaries and wrapped surnames under counted, fail-closed parsing rules.

| Metric | 2022 | 2024 | 2026 | Total |
|---|---:|---:|---:|---:|
| District contests | 12 | 12 | 12 | 36 |
| Democratic candidate rows | 20 | 25 | 38 | 83 |
| Candidate votes | 413,294 | 513,633 | 595,674 | 1,522,601 |
| Source-marked winners | 12 | 12 | 12 | 36 |
| Source incumbent markers | 9 | 8 | 8 | 25 |

The 2022 and 2024 district 12 Democratic sections wrap Bonnie Watson Coleman's `(w) *` markers onto the line below her party-labeled candidate header. The parser accepts that exact marker-only continuation cell and binds both source markers to her row. It does not infer a winner from vote totals, infer that a single reported candidate was uncontested, or convert a missing value into zero.

## Integrity and status

- Artifact: `data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json`
- Artifact size: 67,259 bytes
- Artifact SHA-256: `f605cbdcb6c20694df4daf3dd9bd9be21489518d3aa3cb48bd8a8f5037ba060e`
- Contest-set SHA-256: `5f06d436f125403cf12a7aa0531a9d9e4348f9b4f7c8925ab86714072ec72946`
- Package SHA-256: `946205e381d17d6351f2f86867da9fd54280b5d8680c8a34ac7bde7914293157`
- Evaluator numeric values: 0
- Score-eligible contests: 0
- Review status: proposed; reviewer null; reviewed timestamp null
- Publication status: reviewer-only and nonpublishable

The source family is stronger than an election-night presentation because the Division explicitly publishes these as official primary results. This receipt nevertheless records `division_labeled_official_result_not_separate_seal`: a separate signed or sealed cycle-level certification instrument has not been retained and reconciled. Candidate names and printed incumbent markers are source observations, not current-incumbent BioGuide bindings or progressive classifications. Historical-district compatibility, candidate identity, classification, human review, and publication approval remain open.

The additive certification-availability assessment now retains N.J.S.A. 19:23-57, which requires a distinct Secretary canvass of county-clerk statements for the state or portions thereof involving more than a single county or congressional district and a certificate for each person shown to have been nominated. It therefore preserves all three official lists as strong result candidates without treating them as the separate post-canvass certificate. See [`nj-pa-primary-certification-availability-assessment-v1-2026-08-05.md`](./nj-pa-primary-certification-availability-assessment-v1-2026-08-05.md).

The official PDFs include candidate mailing or street addresses. Those bytes are retained only as part of the original public source documents; the derived receipt excludes every address field and retains only candidate name, votes, `(w)` marker, and `*` incumbent marker.

Official sources:

- [New Jersey 2022 election information](https://www.nj.gov/state/elections/election-information-2022.shtml)
- [New Jersey 2022 official U.S. House primary results](https://www.nj.gov/state/elections/assets/pdf/election-results/2022/2022-official-primary-results-us-house.pdf)
- [New Jersey 2024 election information](https://www.nj.gov/state/elections/election-information-2024.shtml)
- [New Jersey 2024 official U.S. House primary results](https://www.nj.gov/state/elections/assets/pdf/election-results/2024/2024-official-primary-results-us-house.pdf)
- [New Jersey 2026 election information](https://www.nj.gov/state/elections/election-information-2026.shtml)
- [New Jersey 2026 official U.S. House primary results](https://www.nj.gov/state/elections/assets/pdf/election-results/2026/2026-official-primary-results-us-house.pdf)

No source-stated reuse license was found, so reuse terms remain `not_stated_by_source`.

## Reproduction

```bash
npm run fetch:nj-house-primary-results
npm run generate:nj-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/new-jersey-house-democratic-primary-results-receipt.test.ts
npm run data:verify
```

The fetch command re-downloads all three official PDFs, verifies exact bytes and hashes, requires Poppler `pdftotext` 26.07.0, reproduces the layout extracts, and rejects any output conflict. The generator exclusively creates the receipt and rejects an existing nonidentical artifact.
