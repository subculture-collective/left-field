# Ohio House Democratic primary results receipt

Date: 2026-08-06
Status: proposed reviewer-only evidence; not approved, selected, score-bearing, published, or deployed

## Result

The receipt retains the Ohio Secretary of State's exact browser-served result-file manifest, a deterministic complete May 3, 2022 election extract, the plausible 2022 Democratic statewide summary workbook, and the applicable 2024 and 2026 Democratic summary workbooks. The two applicable workbooks identify themselves as official canvasses and each reconcile every candidate total against all 88 county rows.

Across 2024 and 2026, the parser validates all 30 regular U.S. House contests, 71 candidate rows, one named write-in, and 1,238,127 votes. The reviewer receipt projects only the five current target districts—OH-01, OH-03, OH-09, OH-11, and OH-13—yielding ten district-cycle observations, 14 candidate rows, and 540,587 votes.

Artifact: `data/metadata/ohio-house-democratic-primary-results-2022-2026-v1.json`
Artifact SHA-256: `84bc99ea4e6fb80d726f50900aeed3a71707c114895a0ba85fe98cba47cae848`
Package SHA-256: `110dc14b66d637475df77560d4790bfed5c7770eb9e85d8cebd199a9c3c68327`
Contest-set SHA-256: `9d88dc5660f8fe7e85481a503ea1b4269895fcf0bf6af78d9d39b0b279d6a505`

## Source and parsing boundary

Ohio's portal blocks unattended HTTP with a Cloudflare challenge. The three workbooks and the full manifest were acquired through the portal's visible normal-browser download path, then imported through a byte-size and SHA-256 guarded local handoff. The importer never treats dashboard HTML as result data.

The deterministic OOXML parser discovers the `Master` sheet through workbook relationships, decodes shared and inline strings, handles self-closing cells, propagates merged office headers, requires the Democratic party marker, preserves named write-ins, validates districts 1–15, and reconciles candidate totals against 88 unique county rows. Blank district/county cells are interpreted only as zero-valued cells within that complete source matrix. Malformed integers, missing district blocks, duplicate county rows, party drift, missing totals, and arithmetic drift fail closed.

The 2024 workbook contains a separate district 6 unexpired-term contest. The parser excludes term-qualified and special House headers before constructing the regular-primary corpus; it does not merge that block with the regular district 6 contest. No analogous nonregular House block is present in the 2026 workbook.

## Exact 2022 gap

May 3—not August 2—is the relevant 2022 congressional primary. The complete retained May 3 portal object has six file groups and 20 files. None is labeled as a congressional or U.S. Representative result source. Its county-by-party description enumerates statewide offices, courts, U.S. Senate, and appellate courts but omits U.S. House. The retained plausible Democratic summary workbook likewise has no `U.S. Congress` sheet and no `Representative to Congress` block.

The receipt therefore emits zero 2022 contest, candidate, disposition, or evaluator rows and records `official_portal_inventory_has_no_us_house_result_file`. This means only that the statewide portal inventory is incomplete for this domain. It does not mean no primary occurred, no Democratic candidate existed, a contest was uncontested, or the vote total was zero. The delayed August 2 state-legislative primary is not substituted. The next official-only acquisition route is the relevant county boards' certified May 3 records.

## Authority and lifecycle limits

The 2024 and 2026 workbooks' own titles support `secretary_official_canvass_workbook`. No separate signed certification instrument is retained in this package, so every contest uses `official_canvass_workbook_separate_certificate_not_retained`; the package does not escalate that boundary based on a press-release summary.

The source provides no explicit winner marker used by this receipt. Numerical maxima are not converted into winners. Candidate names remain source strings; current-incumbent identity is unreviewed. Historical district compatibility is unreviewed. Progressive classification, selection, and all evaluator values remain unset. Every contest is score-ineligible, reviewer-only, and publication-ineligible. The package supplies evidence to the existing source/certification and nonstandard-disposition decisions but resolves neither.

## Reproduction and validation

```bash
OH_PRIMARY_IMPORT_DIR=/path/to/exact-browser-captured-files npm run import:oh-house-primary-results
npm run generate:oh-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/ohio-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
make check
```

The focused test suite covers synthetic OOXML edge cases, exact real-source reproduction, 2022 exclusion semantics, target-only scope, source drift, lifecycle tampering, and canonical artifact equality. The receipt is factual reviewer evidence only; it is not eligible for production deployment until the remaining authority, identity, geography, classification, human-review, and publication gates are completed.
