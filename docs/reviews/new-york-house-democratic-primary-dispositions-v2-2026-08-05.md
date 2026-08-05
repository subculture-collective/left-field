# New York House Democratic primary disposition candidate v2 — 2026-08-05

## Reviewer boundary

This reviewer-only candidate composes the immutable statewide v1 disposition matrix with the independently versioned NYC certified-result receipt. It replaces exactly eight v1 unresolved district-years with locally reported contests and leaves every other v1 classification unchanged. It publishes nothing, retains no vote value, assigns no score, and does not imply statewide result certification.

The local evidence is a retained Board of Elections in the City of New York canvassing-board-certified recap. Candidate names and vote totals remain governed by that parent receipt; they are not copied into this matrix or treated as current-incumbent reviewed, historical-geography approved, progressively classified, evaluator-integrated, or publishable.

## Exact composition

| Cycle | Reported | State-certified uncontested | Unresolved |
| --- | ---: | ---: | ---: |
| 2022 | 15 | 4 | 7 |
| 2024 | 4 | 11 | 11 |
| **Total** | **19** | **15** | **18** |

The eight local replacements are 2022 districts 07, 08, 10, 11, 12, and 13, plus 2024 districts 10 and 14. Each was unresolved in v1. Each v2 row preserves its v1 row hash, state ballot-certification source ID, null state-certification page, and null state `reportedContestId`; a separate local-authority object binds the NYC contest hash, source ID and file hash, local attestation date, result status, and result scope.

- Seat-cycle rows: **52**
- Local reported overrides: **8**
- Vote values, evaluator numeric values, and score-eligible rows: **0**
- Disposition-set SHA-256: `e1bbe206bf5d2e10d16e1e6fdfafbf296eb4d50221b51904e5f4ec3007b9f6fb`
- Package SHA-256: `708fb98844ecbb3664a10be938459d93e487cf2a7c16cc4e0ae573f4361de645`
- File SHA-256: `33520e143126e6e706222e00db9818ef43349ce2d2ce5e6c3424a3fead45dacf`

The generator validates both parents at their fixed package commitments, normalizes `nyc:` contest coordinates only for set comparison, proves the local set is exactly the eight v1-unresolved rows, preserves state and local IDs in distinct fields, and rejects fully rehashed attempts to collapse those authorities.

## Remaining gates

1. Retain county-board ballot and result authority for the remaining 18 unresolved district-years.
2. Review current-incumbent candidate identity and historical-district compatibility.
3. Retain contest-effective progressive candidate classifications where required.
4. Complete human data review and explicit publication approval.

Absence from a result index remains unresolved, never an inferred uncontested, no-primary, or zero-vote disposition.

## Reproduction

```bash
npm run generate:ny-house-primary-dispositions-v2
npx vitest run src/ingestion/elections/new-york-house-democratic-primary-dispositions-v2-receipt.test.ts
npm run data:verify
npm run typecheck
```
