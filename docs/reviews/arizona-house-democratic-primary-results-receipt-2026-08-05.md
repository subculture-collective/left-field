# Arizona House Democratic primary results receipt

Date: 2026-08-05  
Status: proposed reviewer-only evidence; not approved, selected, score-bearing, or published

## Result

The receipt retains all nine U.S. House district blocks from Arizona's signed 2022 statewide primary canvass and all nine from the revised 2024 official canvass. Seventeen blocks contain reported Democratic contests. The complete 2022 district 8 block contains only a Republican row, so the receipt records only `no_democratic_candidate_reported_in_complete_official_district_block`; it does not infer no primary, no candidate, no nominee, or a numeric evaluator value.

The retained facts contain 29 named candidate rows and 945,906 named-candidate votes. The final 2024 district 3 recount separately reports 93 aggregate write-in votes, producing 945,999 total retained votes. Candidate sums plus that aggregate channel reconcile exactly.

Artifact: `data/metadata/arizona-house-democratic-primary-results-2022-2026-v1.json`  
Artifact SHA-256: `17f6148269291c59942b43f3f012c6f0396b0fc52ef7f0384c4c53762d755e36`  
Package SHA-256: `119a76ada904d3d03e121ecce285841492654b02d24572cd3f2b690d974eb752`  
Contest-set SHA-256: `98e56f97d7c18b72c36f89c5132f82de426cff7292437e4fed9dad10e6417548`

## Official-result and recount boundaries

The retained Arizona post-election procedure says the canvass officially certifies the election and includes race totals and write-in votes. The source asterisks are preserved only as source winner markers; they do not establish current identity, historical-geography compatibility, progressive classification, selection, or score eligibility.

The 2024 district 3 initial canvass reports Yassamin Ansari 19,087, Raquel Terán 19,045, and Duane M. Wooten 4,687. The final recount supersedes those values for district 3 only: Ansari 19,087, Terán 19,048, Wooten 4,686, aggregate write-in 93, total 42,914. The court order identifies Ansari as receiving the highest vote count and directs issuance of the nomination letter. The receipt gives district 3 the canvass, recount, order, OCR, and narrowly verified page-7 transcription source IDs; the latter makes every final-table value fail-closed despite imperfect OCR.

The official 2024 canvass spells the district 1 source candidate name `Andrew Home`. That spelling is retained verbatim. Any correction or linkage to a current identity requires separate source-traceable review.

The 2022 district 9 block reports two named write-in candidates but provides neither with a source winner marker. The receipt does not infer a winner.

## August 5, 2026 cutoff

The captured Arizona election page labels the available result link “Unofficial 2026 Primary Election Results” and schedules the official statewide canvass for August 6, one day after the source cutoff. The package therefore retains zero 2026 result, candidate, disposition, or evaluator rows. A later certified canvass must become a separately versioned source package.

## Lifecycle

Every contest remains identity- and geography-unreviewed, unselected, evaluator-null, score-ineligible, reviewer-only, and publication-ineligible. The receipt supplies evidence to two unresolved parent decisions and resolves neither. No reviewer identity, approval, signature, promotion, or publication state is asserted.

## Reproduction

```bash
AZ_PRIMARY_IMPORT_DIR=/path/to/exact-browser-captured-files npm run import:az-house-primary-results
npm run generate:az-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/arizona-house-democratic-primary-results-receipt.test.ts
npm run data:verify
```
