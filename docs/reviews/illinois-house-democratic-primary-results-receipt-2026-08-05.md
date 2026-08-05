# Illinois House Democratic primary result candidate — 2026-08-05

## Status

This is a reviewer-only, nonpublishable official-result candidate. It retains Illinois State Board of Elections congressional result exports for every district in the June 28, 2022, and March 19, 2024, general primaries, but it does not claim that the result files themselves prove final certification. No contest is score-eligible and the public release is unchanged.

## Exact closure

- Two retained official House listing pages enumerate 17 congressional exports per cycle.
- Thirty-four retained district CSVs cover districts 01–17 exactly once in each cycle.
- The strict parser validates all 163,757 source lines and aggregates 81,421 Democratic-ballot rows using authority party ID `11`.
- The candidate contains 95 cycle-and-contest-scoped candidate records, 1,603,312 candidate votes, and 189,772 blank-, under-, and over-votes.
- Thirty-two contests contain candidate rows. IL-16 contains a Democratic ballot record but no Democratic candidate rows in both cycles; those two contests are explicitly `no_democratic_candidate_rows`, never numeric zero evidence for an incumbent.
- Package SHA-256: `4c0f7bc0505b9e02d03585d8acd0fe47d6599b194f6efcdbcd6e40896d6a663f`.
- File SHA-256: `3016e345d7989ff302557034fb65a63aff92a94f0fec3981b586bf7ea07f9534`.

Illinois varies Democratic display labels by jurisdiction and varies write-in capitalization. The parser keys on numeric authority identifiers and canonicalizes only case-equivalent write-in labels. Candidate names otherwise must agree for the same authority candidate ID. Some 2022 jurisdictions provide votes in blank-precinct summary rows alongside zero-valued precinct placeholders. The parser accepts that documented channel shape but fails if summary and precinct channels both carry positive votes for the same jurisdiction and ballot option, preventing double-counting.

The ASP.NET listing response contains request-specific state and is not byte-stable across live requests. Acquisition therefore retains the first structurally complete response immutably, proves completeness from its normalized 17-link set, and binds the retained bytes in the source lock. Every replay also fetches the current live listing and requires its normalized district/URL set to equal the retained 17-link set; whole-page bytes are not compared because request-specific state changes them. Every result CSV is independently refetched and required to match its retained byte size and SHA-256.

## Unresolved gates

The candidate encodes four blockers:

1. retain a final Illinois statewide canvass or certification artifact covering these exact contests;
2. bind historical candidates to current incumbents with authoritative identifiers or explicit review;
3. approve exact historical-district compatibility or a reviewed crosswalk to the CD119 target;
4. retain a separate reviewed, contest-effective progressive candidate classification.

Until those gates close in a new versioned artifact, `certificationStatus` is `not_retained`, evaluator values are null, `scoreEligible` is false, and `publicationEligible` is false. Official result acquisition alone does not authorize scoring or publication.

## Reproduction

```bash
npm run fetch:il-house-primary-results
npm run generate:il-house-primary-results-receipt
npx vitest run src/ingestion/elections/illinois-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
```
