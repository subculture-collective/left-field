# New York current-incumbent primary linkage candidate v1

## Outcome

This reviewer-only candidate closes the exact 38-observation universe formed by 19 current New York Democratic U.S. House target seats and the retained 2022 and 2024 primary disposition cycles. It composes 16 reported contests, seven state-certified uncontested dispositions, and 15 dispositions that remain unresolved outside retained authority. The 16 reported contests contain 55 candidate rows and 652,367 candidate votes.

The package proposes 12 current-incumbent relationships: six exact normalized-name observations and six finite derived relationships. Four 2022 reported contests remain explicit no-matches because their candidates belong to predecessors of the current incumbents in districts 03, 16, 22, and 26. The other 22 observations retain their uncontested or unresolved disposition with null contest, candidate, and vote values; neither absence state becomes a zero, nominee, winner, or identity link.

## Finite relationship matrix

- Exact normalized names: 2022 NY-07, NY-08, NY-13, and NY-19; 2024 NY-14 and NY-22.
- Clerk middle initial absent from the source: Daniel Goldman in 2022 and 2024 NY-10.
- Source middle initial absent from the Clerk name: Jerrold L. Nadler in 2022 NY-12, Paul D. Tonko in 2022 NY-20, and George S. Latimer in 2024 NY-16.
- One explicit retained public-alias relationship: source `Pat Ryan` in 2022 NY-18 to Clerk `Patrick Ryan`, supported by the retained Congress-current alias `Pat Ryan (politician)` after removing only its parenthetical descriptor.
- Explicit no-match: 2022 NY-03, NY-16, NY-22, and NY-26. The predecessor candidates are not cross-linked to Suozzi, Latimer, Mannion, or Kennedy.

The implementation uses only this finite audited table. It does not use fuzzy matching, unrestricted nickname inference, vote rank, or an inferred source winner.

## Authority and lifecycle boundaries

The v2 disposition matrix supplies the exact status coordinate for every observation but intentionally carries no candidate or vote values. Nine reported target observations bind the statewide reported-result parent and retain `official_reported_contest_candidate` with final certification `not_independently_retained`. Seven bind the exact `localAuthority.localCertifiedContestId` from the New York City certified-result parent and retain `local_canvassing_board_certified_candidate`. The package preserves the separate `ny:` disposition and `nyc:` result identifiers.

Composition establishes no source winner. Every observation carries `sourceWinnerStatus: not_established_by_composition`, `identityApproved: false`, and `scoreEligible: false`. The package and inherited source-selection decision remain proposed with null reviewer, resolution, and timestamp. Historical district geography, progressive classification, remaining county authority, final human review, publication, evaluator use, and deployment remain unresolved. The safe default excludes all 38 observations from the evaluator.

## Reproduction and integrity

```bash
npm run generate:ny-current-incumbent-primary-linkage-v1
npx vitest run src/ingestion/elections/new-york-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
```

The artifact is 76,782 bytes with file SHA-256 `094eccb9a8c9e14a22cc3133d92775fa58c6fd60bebf8aa9df2a870f53061edc`. Its package SHA-256 is `193cf7041b027d542f6a72a9a40bc356f8ba3e502d1b61db7e85440df51418fe`, and its observation-set SHA-256 is `b62cb6048e08fc09a0e983b50d2ac36d7b0ad5e1efb3ca3bc43f00e5f0220768`.

The source-lock entry has exactly seven direct parents: the current target roster, source-selection proposal, House Clerk identity source, Congress-current alias source, v2 New York disposition matrix, statewide reported results, and NYC certified results. Validation rejects source-lock or parent drift, row/set/package hash drift, cardinality drift, and fully rehashed attempts to fabricate approval or reviewer state.
