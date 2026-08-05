# Pennsylvania House Democratic primary results receipt — 2026-08-05

## Outcome

The complete Pennsylvania Department of State 2022 and 2024 primary precinct-return extracts and their format readmes are retained byte-for-byte. The receipt filters only exact primary (`P`), U.S. Congress (`USC`), Democratic (`DEM`) rows and aggregates precinct votes by cycle, congressional district, and state-issued candidate number.

| Metric | 2022 | 2024 | Total |
|---|---:|---:|---:|
| Department source rows | 353,742 | 368,555 | 722,297 |
| Accepted Democratic U.S. House precinct rows | 14,088 | 13,285 | 27,373 |
| District contests with reported rows | 14 | 17 | 31 |
| Candidate groups | 23 | 25 | 48 |
| Candidate votes | 1,067,509 | 1,039,964 | 2,107,473 |

The 2022 source contains no qualifying rows for districts 13, 14, or 15. Each is explicitly `no_reported_democratic_us_house_rows_in_department_extract` with `numericUse: unresolved_not_zero`. The receipt does not infer that those races were uncontested, had no candidate, or had zero votes.

## Source integrity and known repair

The Department readmes document a 37-field, comma-delimited, headerless format. All 2022 rows conform. Thirty-five 2024 rows contain one unquoted comma in the exact municipality text `MANOR X MANOR,NEW`, yielding 38 parsed fields. The parser repairs only that exact field sequence, records `mechanicallyRepairedSourceRows2024: 35`, and rejects every other shape deviation. Candidate identifiers and vote fields are outside the repaired field.

The 2022 file uses quoted integral values; the 2024 file uses integral decimal strings such as `2024.0`. Numeric parsing accepts only unsigned integers or an exact `.0` suffix. Fractional, missing, negative, malformed, or unsafe values fail closed.

The official historical-data index states that Department returns remain unofficial until certified and distinguishes state-tabulated official countywide returns from precinct returns maintained by counties. The exact retained files are therefore labeled `department_extract_not_independently_verified_certified`. The 2024 statewide primary was separately certified, but that announcement does not cryptographically bind this exact extract. A cycle-specific certification artifact must be retained and reconciled before promotion.

Official sources:

- [Pennsylvania historical election data](https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data)
- [2024 primary certification announcement](https://www.pa.gov/agencies/dos/newsroom/secretary-of-the-commonwealth-certifies-2024-primary-election-re)
- [Pennsylvania election results](https://www.electionreturns.pa.gov/)

No source-stated reuse license was found, so `licenseOrReuseTerms` remains `not_stated_by_source`.

## Reproduction

```bash
npm run fetch:pa-house-primary-results
npm run generate:pa-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/pennsylvania-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json`

- Artifact SHA-256: `5815a8ed7e5cadb59c63f27598e0afbc9ec3fa469ecf3837ae0bf3b533920644`
- Contest-set SHA-256: `82e392e32a1520bb58f74603f64ccb24af1edf89914554c4559a58f56dcc96b1`
- Package SHA-256: `2cfc554133dcdcde38e345c2af67636f7cb5b1ec1c5290f5db27dab11be2f6eb`
- Evaluator numeric values: 0
- Score-eligible contests: 0
- Review status: `proposed`
- Publication eligible: false
