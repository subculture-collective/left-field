# Washington current-incumbent top-two linkage candidate v1

## Outcome

This reviewer-only candidate closes the exact 16-observation universe formed by eight current Washington Democratic U.S. House target seats and the retained certified 2022 and 2024 top-two contests. The contests contain 115 candidate rows and 3,141,178 reconciled votes.

The package proposes 15 current-incumbent relationships: 13 exact official-name observations and two finite middle-initial relationships for Suzan K. DelBene. The 2022 WA-06 contest remains an explicit no-match because incumbent Emily Randall was not a candidate; predecessor Derek Kilmer is not cross-linked to her. No observation is automatically approved, selected, or score-eligible.

## Finite relationship matrix

- Exact official names: both cycles for WA-02, WA-03, WA-07, WA-08, WA-09, and WA-10, plus 2024 WA-06.
- Clerk middle initial absent from the source: `Suzan DelBene` in both WA-01 cycles to Clerk `Suzan K. DelBene`.
- Explicit no-match: 2022 WA-06. The predecessor candidate is retained only in the underlying contest and is not substituted for the current incumbent.

The implementation uses only this finite audited table. It does not use fuzzy matching, vote rank, inferred advancement, or an inferred source winner.

## Authority and lifecycle boundaries

Every observation inherits `certificationStatus: certified`, `nominationSystem: top_two`, and `formulaApplicability: confirmed_incompatible` from the retained Washington receipt. Official party-preference labels remain source observations; they are not converted into party nomination, party endorsement, a Democratic-primary total, a winner, or advancement. The package supplies zero evaluator numeric values.

Every identity remains proposed with `identityApproved: false`, `selected: false`, and `scoreEligible: false`. The package, inherited source-selection decision, and formula-exclusion decision retain null reviewer resolution. Historical district geography, progressive classification, human review, publication, evaluator use, and deployment remain separate unresolved gates. The safe default excludes all 16 observations from the partisan-primary evaluator.

## Reproduction and integrity

```bash
npm run generate:wa-current-incumbent-top-two-linkage-v1
npx vitest run src/ingestion/elections/washington-current-incumbent-top-two-linkage-candidate.test.ts
npm run data:verify
```

The artifact is 34,961 bytes with file SHA-256 `d8abddb956831e60487d65cf4b26fec5112032737be73f547d12af7338961093`. Its package SHA-256 is `8ef11d58375a07018cdf05bffce1b68777c1d013149a3d292c69c7e52cd1db11`, and its observation-set SHA-256 is `5be84bd55abebdaf647b95727db0b324d4a70fc0167c7a08478a0a35246267ae`.

The source-lock entry has exactly five direct parents: the current target roster, source-selection proposal, House Clerk identity source, Congress-current identity source, and certified Washington top-two receipt. Validation rejects source-lock or parent drift, row/set/package hash drift, cardinality drift, and fully rehashed attempts to fabricate identity approval, selection, score eligibility, or reviewer state.
