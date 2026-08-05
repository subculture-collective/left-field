# Oregon House Democratic primary results receipt

Status: **proposed reviewer-only factual package; not approved, published, or evaluator-eligible**

Source cutoff: **2026-08-05**

The receipt parses the Democratic U.S. House result block for all six Oregon congressional districts in the May 17, 2022, May 21, 2024, and May 19, 2026 official statewide primary abstracts. It retains 18 district-cycle contests, 60 named candidate rows, 1,374,882 named-candidate votes, 10,096 votes in separate `Misc.` aggregate channels, and 1,384,978 total Democratic primary votes.

Artifact: `data/metadata/oregon-house-democratic-primary-results-2022-2026-v1.json`

Every vote value is parsed from the matching source block's statewide `Total` row. Generation requires the exact PDF and deterministic text-extract bytes for all three cycles, exactly one Democratic block per district, the expected fixed-width candidate-header tokens in source order, one `Total` row, and exact candidate-column closure plus `Misc.`. It also parses every numeric county row and requires each candidate and `Misc.` column sum to equal the statewide `Total` value. The candidate display names reconstruct the source's multi-line fixed-width headers; they do not create candidate identifiers or current-person matches.

All 18 contests contain exactly one direct `* Nominee` marker. That marker is retained as a source fact rather than inferred from vote rank. The package does not turn nomination into current-incumbent identity, progressive classification, historical-geography compatibility, evaluator applicability, or a scoring decision. `Misc.` remains an aggregate source channel, not a named candidate, write-in identity, or zero.

Every contest remains identity- and geography-unreviewed, unselected, evaluator-null, score-ineligible, reviewer-only, and publication-ineligible. The source-lock entry proves the exact proposed artifact; it is not reviewer approval or factual promotion.

```sh
npm run import:or-primary-abstracts
npm run generate:or-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/oregon-house-democratic-primary-results-receipt.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `e27397dec36c7804ca220bd19647d5c18112f8a0b02f505b4ff443660bd1c25f`

Contest-set SHA-256: `4d9eedd708ebe4687d3aeeb0821448e2bf9939031e4a24317aa0c019c76e9ca1`
