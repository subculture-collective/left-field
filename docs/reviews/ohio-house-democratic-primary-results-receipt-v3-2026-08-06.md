# Ohio House Democratic primary results receipt v3

Date: 2026-08-06
Status: proposed reviewer-only county evidence; not approved, score-bearing, published, or deployed

## Result

V3 adds five exact official-county source files to immutable v2: Warren for OH-01 and Erie, Ottawa, Sandusky, and Williams for OH-09. The complete county-progress layer now holds ten of the research-derived 15 required segments, 11 candidate rows, and 181,714 candidate votes.

No 2022 district contest is emitted. The controlling Secretary of State county-composition PDF renders at its official URL, but direct byte retrieval still returns a Cloudflare challenge and the browser did not expose downloadable exact bytes. Its content therefore remains research context rather than source-locked geography authority.

The district-level target corpus remains exactly ten 2024/2026 observations, 14 candidates, and 540,587 votes. V3 creates no winner, identity, geography approval, evaluator value, score eligibility, reviewer approval, publication state, or deployment state.

Artifact: `data/metadata/ohio-house-democratic-primary-results-2022-2026-v3.json`

Artifact SHA-256: `dc7baadc8bc7a314824532a54a1df1d054044942464bbef2b2401ff9533ad1c5`

Package SHA-256: `4ea53334aa91c5bdc45ef63305a611a133c8f06804a03440fb664c4fcf30d109`

Contest-set SHA-256: `f45a0de76d61ccd752dbbcc5604fe6a8cd7997798393970e1ab1aed18f28b556`

## Added county evidence

| County / contribution | Source finality | Candidate votes | Source SHA-256 |
| --- | --- | ---: | --- |
| Warren / OH-01 full county | Official Election Results, 175/175 | Greg Landsman 4,867 | `eace77a04275e47919af9dc08c1f8fece729b6b80a58c0497fffb782015fdca0` |
| Erie / OH-09 full county | Official Canvass, 62/62 | Marcy Kaptur 3,388 | `e15821ff0bc19a6b532da77237f879740873869821ad05d4ce1f91ce642ab72a` |
| Ottawa / OH-09 full county | Amended Official Results, 36/36 | Marcy Kaptur 2,138 | `1ba473a90485d1b35d75076d152556a7883d201ee7ae25d2b77e9c2cb34d576c` |
| Sandusky / OH-09 full county | Official Results, 58/58 | Marcy Kaptur 2,177 | `2bdafad3985b1d1960e6e6b2d6c28bd760386af8d58d827832e76cb6711f9c27` |
| Williams / OH-09 full county | county archive and body say official; vendor footer says unofficial | Marcy Kaptur 756 | `4d6c8a09907a172f60a9bde228a108c66b183c7cf1bfb58d910470ad752fe3c9` |

Williams is retained with `finalityCaveat: official_archive_and_report_label_conflict`. The receipt does not erase or resolve the contradictory label.

## Remaining acquisition boundary

- OH-01, OH-03, and OH-11 have no missing county segment in the research matrix, but remain non-observations until the controlling authority bytes are retained.
- OH-09 still needs exact retained final county totals for Defiance, Fulton, and Lucas. Lucas's surviving Board-hosted snapshot is explicitly unofficial and excluded. Defiance precinct evidence and Fulton rendered evidence are not substituted for exact total-bearing payloads.
- OH-13 still needs Portage and Stark district-scoped official results.
- Williams finality conflict, certification instruments, identity, historical geography, progressive classification, review, promotion, and publication remain unresolved.

## Deterministic controls

The importer accepts only the five exact byte lengths and SHA-256 values. Every semantic extract has its own pinned SHA-256 before parsing. Parsers bind event, district, party, candidate, votes, finality labels, and precinct closure. The v3 builder binds the exact v2 parent file/package, exact five-source closure, all ten county segments, the unchanged ten-contest parent corpus, and zero 2022 district observations. Canonical package and contest-set constants protect standalone validation from fully rehashed factual drift.

```bash
OH_2022_COUNTY_PRIMARY_V3_IMPORT_DIR=/path/to/exact-capture npm run import:oh-2022-county-primary-results-v3
npm run generate:oh-house-primary-results-receipt-v3
npm run test:run -- src/ingestion/elections/ohio-house-democratic-primary-results-receipt-v3.test.ts
npm run typecheck
npm run data:verify
make check
```
