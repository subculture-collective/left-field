# North Carolina Democratic U.S. House primary results receipt — 2026-08-05

Status: deterministic reviewer-only candidate; not approved, published, score-eligible, deployed, or publicly displayed.

The receipt parses the complete NCSBE statewide archives for the 2022, 2024, and 2026 primaries. It validates all 16,223 retained Democratic U.S. House source rows by requiring each row's election-day, early/one-stop, absentee-mail, and provisional components to equal its reported total before aggregating by contest and candidate.

The resulting candidate contains 22 reported contests—nine in 2022, two in 2024, and eleven in 2026—with 76 named candidate rows and 1,142,284 votes. The full statewide archive is the denominator. Twenty of 42 district-cycle blocks have no reported Democratic U.S. House contest, but remain unresolved rather than becoming zero, uncontested, or no-primary dispositions.

The parser independently reads both retained canvasses. The 2024 archive reconciles exactly. The 2022 archive conflicts with the canvass on four candidate observations: Barbara D. Gaskins (+9 canvass), Joe Swartz (+3), Jay Carey (+1), and Jasmine Beach-Ferrara (+2). The archive totals 424,306 votes while the canvass totals 424,321. The exact 15-vote difference is serialized as `source_conflict_unresolved`; neither source silently supersedes the other. The 2026 contests bind only the official archive and explicitly use `not_closed_by_retained_instrument`.

All 20 unreported district-cycle keys are serialized explicitly as unresolved. Every reported contest and unresolved block remains identity- and geography-unreviewed, unselected, evaluator-null, score-ineligible, reviewer-only, and publication-ineligible. Candidate names and party labels are direct source observations; they are not current-incumbent identity links or progressive classifications.

Reproduce and verify with:

```sh
npm run generate:nc-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/north-carolina-house-democratic-primary-results-receipt.test.ts
npm run data:verify
```
