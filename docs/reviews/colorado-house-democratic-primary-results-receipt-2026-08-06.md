# Colorado House Democratic primary results receipt — 2026-08-06

## Status

This is a complete reviewer-only, nonpublishable official-abstract result candidate. It retains every Democratic U.S. House district and county segment reported by the Colorado Secretary of State for the June 28, 2022, June 25, 2024, and June 30, 2026 primaries. It does not bind source names to current incumbents, approve historical geography, classify candidates, select a contest, supply evaluator values, infer a winner, or change the public release.

## Exact closure

- 24 district-cycle contests: districts 01–08 exactly once in each of three cycles.
- 249 county segments, including 7 source rows whose district total is explicitly zero.
- 39 named candidate options, including the named write-ins John Wren in 2024 and Jenna Preston in 2026.
- 1,800,710 votes: 508,675 in 2022, 475,390 in 2024, and 816,645 in 2026.
- Every county row equals its candidate-option sum; every candidate total equals its county-column sum; every district total equals both its candidate sum and county sum.
- Contest-set SHA-256: `b1619063732c5ea17bc37e473239abb18faa3dc948671420b98357e58fd26116`.
- Package SHA-256: `c5f2e3c5bda8b027b9879911e07a99d3623a656a5aa717a5408079dc15bf4b55`.
- File SHA-256: `9f06ea32b7ff7564829d163dbecbf6e78a61c2ebb95e3d31d3875d7a64027569`.

## Authority and finality

The cycles deliberately retain different, source-specific finality semantics:

| Cycle | Result authority | Certification evidence |
| --- | --- | --- |
| 2022 | Official Secretary of State HTML abstract | The retained July 25 certification announcement says county canvass boards signed the final results and links the separately retained `2022 State Primary Certificate including the Statewide Abstract of Votes Cast`. |
| 2024 | Official Biennial Abstract | The publication describes the primary results as official and certified and says the county-submitted values supersede less-accurate initial web totals. No separate signed certificate is retained. |
| 2026 | Signed Secretary statewide abstract | Page 1 contains the Secretary's certificate, dated July 24, 2026, directly binding the attached statewide abstract to the June 30 primary. |

The 2022 House page is structured HTML and is parsed directly. The 2024 PDF is text-bearing; the importer runs a bounded district-table extraction and rejects page-header false positives, missing districts, missing counties, and arithmetic drift. The 2026 PDF is image-only. Its normalized JSON is a visually checked transcription of pages 3–5; the exact signed PDF remains authoritative. OCR was used only as an extraction aid and ambiguous cells were checked against rendered source pages before the normalized file was accepted.

The source tables do not carry a winner marker. The receipt therefore records `sourceWinnerStatus: not_marked_by_source` and `winnerSourceCandidateName: null` for every contest instead of treating the highest vote total as a direct source fact.

The Secretary of State site publishes terms that do not state an open-data license for these source publications. The receipt records `licenseOrReuseTerms: not_stated_by_source`; it does not claim public-domain or open-license status.

## Lifecycle boundary

All 24 contests have `currentIdentityStatus: not_reviewed`, `geographyStatus: not_reviewed`, `selectionStatus: unselected`, null evaluator values, `scoreEligible: false`, and `publicationEligible: false`. The 12 current-target district-cycle positions for CO-01, CO-02, CO-06, and CO-07 are only a coverage count. Exact-name observations are not silently converted into BioGuide bindings, and the 2026/CD120 plan is not silently treated as the CD119 target geography.

The remaining gates are current-incumbent identity review, historical-district compatibility review, progressive-candidate classification, and explicit human review/publication approval.

## Reproduction and validation

The importer expects a five-file exact official capture bundle and refuses any byte drift. It deterministically rebuilds the 2024 normalized extract and the visually verified 2026 transcription:

```bash
CO_PRIMARY_IMPORT_DIR=/path/to/exact-colorado-capture npm run import:co-house-primary-results
npm run generate:co-house-primary-results-receipt
npx vitest run src/ingestion/elections/colorado-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
```

Official sources:

- [2022 certification announcement](https://www.coloradosos.gov/pubs/newsRoom/pressReleases/2022/PR20220725PrimaryCertification.html)
- [2022 signed statewide abstract](https://www.coloradosos.gov/pubs/newsRoom/pressReleases/2022/2022StatePrimaryAbstract.pdf)
- [2022 Democratic U.S. House abstract](https://www.coloradosos.gov/pubs/elections/Results/Abstract/2022/primary/democratic/usRepresentatives.html)
- [2024 Biennial Abstract](https://www.coloradosos.gov/pubs/elections/Results/2024/2024BiennialAbstract.pdf)
- [2026 signed statewide abstract](https://www.coloradosos.gov/pubs/elections/Results/2026/2026PrimaryStateAbstractofResultsCast.pdf)
