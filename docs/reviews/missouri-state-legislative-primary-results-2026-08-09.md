# Missouri state-legislative primary results receipt — 2026-08-09

## Outcome

The retained 2022 and 2024 Missouri Secretary of State primary-result PDFs now produce a deterministic, reviewer-only state-legislative context projection. It contains 565 reported Democratic or Republican party contests, 758 candidate rows, and 2,700,680 candidate votes. No row is eligible for the House Priority Index.

## Bound sources

| Cycle | Source | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| 2022 | Archived official result PDF | 1,283,832 | `9d62384135197ee0722eb5be00ac4c2b4eb05a05b65b04c9723298a26b06db06` |
| 2022 | `pdftotext -tsv` 26.07.0 coordinate extract | 1,537,628 | `757c9a39ed6eab84825d843123ac6c8443730b6639214a0ac3c13a7db2d70d3d` |
| 2024 | Official result PDF | 1,763,712 | `c3cbf17b8598920730c77e58b97be404d2a015573ff876952eb025681577cb54` |
| 2024 | `pdftotext -tsv` 26.07.0 coordinate extract | 2,146,922 | `aa29f5ad4600f3a4e1888a87d1eb6ddf9a73bae530066f013b33a8053bf51a76` |

The coordinate extracts are derived children of the corresponding PDFs. The parser binds table headings, candidate labels, party columns, and reported totals by page coordinates, and requires all 180 legislative district tables in each cycle. The exact 2024 source typo `Dmeocratic` is normalized only for party-column classification.

## Closure

| Measure | 2022 | 2024 | Combined |
| --- | ---: | ---: | ---: |
| District tables | 180 | 180 | 360 |
| Democratic or Republican party contests | 260 | 305 | 565 |
| Candidate rows | 364 | 394 | 758 |
| Candidate votes | 1,294,251 | 1,406,429 | 2,700,680 |

The combined corpus has 59 Senate contests and 506 House contests: 257 Democratic and 308 Republican. Each emitted contest total equals the sum of its retained candidate rows.

## Evidence boundary

- Winner identity remains null because the parser does not infer a winner from vote rank.
- Candidate identity remains null; candidate labels are source observations, not cross-system identity links.
- A separate candidate-level certification instrument is not retained.
- No ideological classification, evaluator value, or House-score use is created.
- The projection is factual context only and has `formulaEligible: false` for every contest.

## Reproduction

`npm run generate:rapid-missouri-state-legislative` reproduces the 551,549-byte artifact at `data/metadata/rapid-missouri-state-legislative-primary-results-v1.json`, SHA-256 `4a6e5f94297039f598141ba82cc5bef7d90be17169cf6a7a3a7ffa2fafb22198`, contest-set SHA-256 `5638537a8e2557c73ccce194bdfafaf8e6cc8595f67674d79c478ba04e91c397`, and package SHA-256 `325f92a7b507220a5dac2c2a6721796d18d1936c0d3f5f836327ed21032af746`.
