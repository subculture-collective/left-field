# Ohio House Democratic primary results receipt v2

Date: 2026-08-06
Status: proposed reviewer-only evidence; not approved, selected, score-bearing, published, or deployed

## Result

The immutable v2 receipt extends the statewide-source v1 with five exact official county-board result files from the May 3, 2022 primary. All five county reports explicitly label the relevant Democratic congressional district contest, so no population allocation, precinct interpolation, modern-map substitution, or countywide cross-district total is used.

The files yield five county-result segments containing six candidate rows and 168,388 votes. They are retained as acquisition progress only. The controlling official county-composition authority bytes are not retained, so v2 makes zero 2022 district-closure claims and emits zero 2022 district observations—even for OH-03 and OH-11, whose research-derived matrix currently lists no missing county segment.

The district-level target corpus therefore remains the v1 corpus: ten observations, 14 candidates, and 540,587 votes across 2024 and 2026. Every county segment remains separate from the contests array, with no inferred winner, current identity, geography approval, progressive classification, evaluator value, score eligibility, or publication state.

Artifact: `data/metadata/ohio-house-democratic-primary-results-2022-2026-v2.json`

Artifact SHA-256: `589cf7ee3fe2bdba37ae0d9b4b29230dc073e9ff2680f1586fa37214dd03e4f7`

Package SHA-256: `8a5de1394634fa2f415b380ea2f7f49b8a142cbfe5a62dfc278f917af9281636`

Contest-set SHA-256: `8641d3802c2791c0d18bc3b32d3f5c4337de560d4a7d4141f98384e9964de360`

## Retained county evidence

| Target contribution | Official publisher result | Candidate observation | Source SHA-256 |
| --- | --- | ---: | --- |
| Hamilton partial / OH-01 | P22 cumulative official results | Greg Landsman 23,463 | `43298f4a4f5cf37b3a18a5cc66f88b4bf29c4136fb7ea092268ffa257341ab22` |
| Franklin partial / OH-03 | official group detail | Joyce Beatty 48,241 | `d75ce506f457d7974b4a8410b3f82996238bad19f802209494a4099667d1fffa` |
| Wood partial / OH-09 | official summary, 43/43 relevant precincts | Marcy Kaptur 2,547 | `e7d43e9bbf0a471e91b3aae25ffc7ff6c04b409161d057ca7614e207c35e19bb` |
| Cuyahoga partial / OH-11 | official results by contest | Brown 44,841; Turner 22,830 | `a88f4724ed265e406fd5d711b402a07c753bb704e1eda4d8e3af97da8ebdbfb6` |
| Summit full / OH-13 | amended official summary, 420/420 precincts | Emilia Sykes 26,466 | `c76d2eafd052ff23404c6f4ea259de70e1f56a3c976f9773ad24f9773142abf1` |

All five rows are county-segment progress. None is emitted as a district total while the controlling county-composition authority remains unretained.

## Exact closure boundary

The research-derived March 2, 2022 county matrix requires 15 district/county segments:

- OH-01: Hamilton partial and Warren full. Warren is missing.
- OH-03: Franklin partial. No segment is missing in the research-derived matrix, but official authority bytes are missing.
- OH-09: Defiance, Erie, Fulton, Lucas, Ottawa, Sandusky, and Williams full, plus Wood partial. The seven full counties are missing.
- OH-11: Cuyahoga partial. No segment is missing in the research-derived matrix, but official authority bytes are missing.
- OH-13: Portage partial, Stark partial, and Summit full. Portage and Stark are missing.

The controlling Secretary of State county-population and filing-location PDF is verified at `https://www.ohiosos.gov/assets/dir2022-27-04-congressionaldistrictfilinglocation-sos-2022-03-02.pdf`, but automated retrieval returned Cloudflare 403 and an interactive-browser request did not yield downloadable bytes. The receipt records `verified_location_not_retained_cloudflare_403`; it does not pretend the authority is source-locked or treat the matrix as historical-geography approval.

The Portage Board archive exposes official May 3 canvass links but rejected direct acquisition. No separately discoverable unofficial Portage report was retained. A bounded Stark search did not yield the May primary official canvass path. These remain acquisition gaps, not no-contest, uncontested, or zero-vote dispositions.

## Deterministic controls

The importer accepts only the five exact byte lengths and SHA-256 values. The parser anchors each extract to the May 3 event, official/amended-official finality label, Democratic party, exact congressional district, candidate names, vote totals, and reported precinct closure where the source exposes it. It fails closed on source, event, party, district, finality, candidate, vote, or byte drift.

The v2 builder validates the exact v1 parent file and package hashes, exact source-set closure, the 15-segment research matrix, exact semantic-text hashes, and the rule that no 2022 contest may be emitted without retained authority bytes. Canonical package and contest-set hashes make the standalone validator reject even internally rehashed factual drift. Semantic validation prohibits winner inference, lifecycle promotion, non-null evaluator values, or score eligibility.

## Reproduction and validation

```bash
OH_2022_COUNTY_PRIMARY_IMPORT_DIR=/path/to/exact-county-capture npm run import:oh-2022-county-primary-results
npm run generate:oh-house-primary-results-receipt-v2
npm run test:run -- src/ingestion/elections/ohio-house-democratic-primary-results-receipt-v2.test.ts
npm run typecheck
npm run data:verify
make check
```

This package remains reviewer-only and nonpublishable. The next official-only acquisition block is Warren plus the seven whole OH-09 counties and the Stark/Portage OH-13 district-scoped records, alongside renewed retention of the March 2 authority bytes.
