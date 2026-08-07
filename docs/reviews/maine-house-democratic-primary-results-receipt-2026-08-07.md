# Maine Democratic U.S. House primary results receipt - 2026-08-07

## Outcome

The repository retains Maine Secretary of State election-result indexes and Democratic U.S. House result workbooks for the June 14, 2022, June 11, 2024, and June 9, 2026 primaries. The bounded reviewer-only receipt covers all six current-target district-cycle observations for ME-01 and ME-02, with nine candidate rows and 345,162 named-candidate votes in the six workbooks.

The 2026 ME-02 contest is a ranked-choice election. Its detailed first-choice workbook and central-count RCV summary are retained as two distinct official projections. The receipt preserves their 81-vote named-candidate difference and does not overwrite, merge, or silently prefer either projection.

The package is proposed, reviewer-only, score-ineligible, publication-ineligible, and undeployed. It resolves no decision and creates no current-incumbent identity, historical-geography, progressive-classification, evaluator-cycle, or signed-certification conclusion.

## Official sources

The three retained index pages establish the election cycle, party, district, and the Secretary's ranked-choice or non-ranked-choice presentation. The six workbooks supply the district result detail. The separately retained 2026 ME-02 PDF explicitly supplies the central-count rounds, threshold, elimination order, and elected candidate. A deterministic layout-text extract of that PDF is retained for parsing and is directly parented by the PDF.

| Source-lock ID | Retained path | Bytes | SHA-256 |
|---|---|---:|---|
| `maine-2022-election-results-index` | `data/source/elections/primary-results/maine/2022/results-index.html` | 91,949 | `6aa4043e4381dd478001c13dd44cf9cc0cf3b123b6eb69bc00faf7c2bc040c3c` |
| `maine-2022-house-democratic-primary-cd01-results` | `data/source/elections/primary-results/maine/2022/democratic-cd01.xlsx` | 23,933 | `ccc458e06f6e32e0254c72e7f6c5aae1945d002830e59ce0c52af7f81fe4247c` |
| `maine-2022-house-democratic-primary-cd02-results` | `data/source/elections/primary-results/maine/2022/democratic-cd02.xlsx` | 39,910 | `0862338441e04b99ec6eeafbe38e83bdcc50bc55f595d962df73973bd35e35a3` |
| `maine-2024-election-results-index` | `data/source/elections/primary-results/maine/2024/results-index.html` | 89,290 | `c7629e287de1ad4a54bf6cea39b82f4e5bea15f702b38535a3a4b15241b9acca` |
| `maine-2024-house-democratic-primary-cd01-results` | `data/source/elections/primary-results/maine/2024/democratic-cd01.xlsx` | 22,841 | `d5bc8beab80e6d93b0d46c925b36d604e2168b339545b92a960c928a5061179e` |
| `maine-2024-house-democratic-primary-cd02-results` | `data/source/elections/primary-results/maine/2024/democratic-cd02.xlsx` | 29,362 | `9b52fa0124f30b6bc3fd296b52d81270720ce49ddcefe4c6ef11412d77ab13d4` |
| `maine-2026-election-results-index` | `data/source/elections/primary-results/maine/2026/results-index.html` | 102,103 | `9ad0566686fe3d7a8365c07cf1c2ea0af8e975d63e09e4adc770034094b74eb4` |
| `maine-2026-house-democratic-primary-cd01-results` | `data/source/elections/primary-results/maine/2026/democratic-cd01.xlsx` | 18,714 | `18656f07026c2dd1532f8597f920295f13700ca7ab7b1e7e841c805f0a16c11a` |
| `maine-2026-house-democratic-primary-cd02-first-choice-results` | `data/source/elections/primary-results/maine/2026/democratic-cd02-first-choice.xlsx` | 42,349 | `6f0df9d41a38bff5180ef9bbee6b048f87092aada34343b6ff474b9ba6b2dea5` |
| `maine-2026-house-democratic-primary-cd02-rcv-summary` | `data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.pdf` | 36,422 | `d308d461baf07b2ca4ebaab087eea30ad118710e19a67c3c9c54cb8fcad2ad38` |
| `maine-2026-house-democratic-primary-cd02-rcv-summary-layout-text` | `data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.txt` | 949 | `64a534b9204e1291a2fb567d7d70adcdc302dac1f75c749f6f4c78d8b0719f60` |

The official URLs are pinned in `data/source-lock.json`. The three index pages are mutable web resources, so reproducibility rests on the exact retained bytes and hashes, not on an assumption that a later live response will remain identical.

The existing source-selection parent is `house-democratic-primary-source-selection-proposal-20260804-v1`: file SHA-256 `85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1`, package SHA-256 `a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb`.

## Corpus closure

| Cycle | Contests | Candidate rows | Workbook candidate votes |
|---|---:|---:|---:|
| 2022 | 2 | 2 | 68,691 |
| 2024 | 2 | 2 | 69,490 |
| 2026 | 2 | 5 | 206,981 |
| Total | 6 | 9 | 345,162 |

| Contest | Workbook candidates | Named-candidate votes | Blank | Total ballots cast |
|---|---|---:|---:|---:|
| `me:2022:regular:us-house:01:democratic` | Pingree, Chellie M. | 43,007 | 2,722 | 45,729 |
| `me:2022:regular:us-house:02:democratic` | Golden, Jared Forrest | 25,684 | 2,898 | 28,582 |
| `me:2024:regular:us-house:01:democratic` | Pingree, Chellie | 46,307 | 2,914 | 49,221 |
| `me:2024:regular:us-house:02:democratic` | Golden, Jared Forrest | 23,183 | 1,948 | 25,131 |
| `me:2026:regular:us-house:01:democratic` | Pingree, Chellie | 128,257 | 10,664 | 138,921 |
| `me:2026:regular:us-house:02:democratic` | Baldacci; Dunlap; Loud; Wood | 78,724 | 4,756 | 83,480 |

`BLANK` and `TBC` are reconciliation fields, not candidates. County subtotals, state UOCAVA, state totals, percentage rows, and formatting-only rows are not emitted as candidate rows or counted again.

The workbooks bind to six target observations inherited from the source-selection proposal: ME-01 and ME-02 for each of 2022, 2024, and 2026. The receipt does not itself link source names to BioGuide identities. In particular, Jared Golden is absent from the 2026 ME-02 source candidate set; that absence is not converted into a zero, retirement fact, identity conclusion, or nomination conclusion.

## Workbook and formula-cache validation

The parser reads the XLSX ZIP/XML content deterministically and requires the exact expected sheet and header shape for each source:

| Workbook | Sheet | Formula cells |
|---|---|---:|
| 2022 ME-01 | `Rep to Congress - District 1` | 137 |
| 2022 ME-02 | `Rep to Congress - District 2` | 416 |
| 2024 ME-01 | `CG1 DEM` | 137 |
| 2024 ME-02 | `CG2 DEM` | 410 |
| 2026 ME-01 | `Sheet1` | 137 |
| 2026 ME-02 | `Dem CG2` | 435 |

The workbooks contain cached values for formulas such as detail-row candidate-plus-blank totals, county subtotals, and state totals. The formula-cell counts above are an audit inventory and the exact formula-bearing source bytes are hash-bound. The parser independently sums literal candidate and blank vote cells, then checks the cached detail-row and state-total values. In the 2026 ME-02 source, `K352` and `K353` are the two literal detail-row `TBC` exceptions; the parser requires those exact exceptions and requires the other detail-row `TBC` cells to remain formulas. Validation requires:

- nonnegative integer candidate, blank, and total values;
- candidate votes plus blank votes equal each detail-row `TBC` value;
- municipality or precinct detail plus state UOCAVA reconcile to the state total without counting county subtotals again;
- the 2026 ME-02 precinct rows plus UOCAVA reconcile to its final numeric totals row;
- no stale detail/state cache, duplicate locality/precinct key, extra candidate column, or reordered candidate column.

This makes formula caches evidence that is checked, not an unchecked substitute for arithmetic validation.

## Distinct 2026 ME-02 RCV projections

The detailed first-choice workbook reports:

| Candidate | Workbook first-choice votes |
|---|---:|
| Baldacci, Joseph M. | 24,944 |
| Dunlap, Matthew G. | 22,920 |
| Loud, Paige | 8,182 |
| Wood, Jordan | 22,678 |
| Named-candidate total | 78,724 |

The central-count RCV summary reports different round-one values:

| Candidate | Round 1 | Round 2 | Round 3 |
|---|---:|---:|---:|
| Baldacci, Joseph M. | 24,966 | 25,923 | 32,555 |
| Dunlap, Matthew G. | 22,933 | 25,681 | 35,924 |
| Loud, Paige | 8,194 | 0 | 0 |
| Wood, Jordan | 22,712 | 25,377 | 0 |
| Exhausted ballots | 4,675 | 6,499 | 15,001 |

The PDF explicitly records a threshold of 34,240, eliminates Paige Loud and then Jordan Wood, and records Matthew G. Dunlap as elected. Its round-one named-candidate total is 78,805, which is 81 votes greater than the workbook's 78,724 named first choices.

The receipt preserves:

- the workbook first-choice projection;
- the central-count round projection;
- `firstChoiceNamedCandidateDelta: 81`;
- `reconciliationStatus: distinct_official_projections_not_flattened`;
- the PDF's explicit Dunlap source-winner fact.

It does not add the two projections, rewrite one to match the other, call either source erroneous, or sum votes across RCV rounds as independent ballots. Only 2026 ME-02 has an explicit source winner. The five single-candidate workbooks do not expose a winner field, so candidate count or vote rank does not become winner or nomination evidence.

## Authority, topology, and canonical artifact

The workbooks are official Secretary of State primary tabulations. The filenames for both 2024 workbooks and 2026 ME-01 include `FINAL`, and the 2026 ME-02 PDF is an official RCV central-count summary. No separate signed statewide certification instrument is retained and bound to these exact bytes. The package therefore preserves official result status without escalating it to a signed-certificate claim.

The intended output source-lock entry is:

- ID: `maine-house-democratic-primary-results-2022-2026-v1`;
- path: `data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json`;
- kind: `review_candidate`.

Its expected ordered direct parents are the source-selection proposal, the six result workbooks, and the RCV layout-text extract. The three index pages and the original RCV PDF remain reachable through the raw-source parent graph; the receipt should also enumerate all eleven retained inputs inside its provenance payload.

The deterministic artifact is 26,429 bytes. Its file SHA-256 is `8a24a92134030c90dc946bcadf35a4c40b5af2f930acf3f9c007735bd045504c`; package SHA-256 is `cc50030cb023eb43b1cced7b893563f98e70082cc6ae21484360775cd2e81c3e`; contest-set SHA-256 is `2499c8b1d270d192b5372594c87b516b971fe19f6452b017945ed54492af105c`; and target-observation-set SHA-256 is `fc0e3ed9891c3b2bca20aa245bc9225e9314d7dcb119e31c2cf85d30a63414bd`.

## Reproduction and validation

```bash
node scripts/fetch-maine-house-primary-results.mjs
npm run generate:me-house-primary-results-receipt
npx vitest run src/ingestion/elections/maine-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The acquisition path must be create-only/idempotent: existing equal bytes are accepted, while conflicting bytes fail closed. The focused test covers exact retained paths and hashes, six-contest and nine-candidate closure, all workbook totals, formula-cache reconciliation, the distinct RCV projections and 81-vote delta, exact RCV rounds and explicit winner, source-byte drift, output-parent reordering, canonical artifact reproduction, and fully rehashed winner, identity, and scoring escalation.

## Remaining decisions and lifecycle gates

- review current-incumbent candidate identity independently, including the 2026 ME-02 nonappearance boundary;
- review historical district compatibility and keep any 2026/CD120 authority separate;
- decide how the two official 2026 ME-02 first-choice projections may be used without flattening them;
- retain the five non-RCV single-candidate source rows without inferring winner or nomination;
- review progressive candidate classification;
- select an evaluator cycle only after result, identity, geography, disposition, and classification review;
- complete human data review and explicit publication approval;
- perform any later deployment as a separately authorized production mutation.
