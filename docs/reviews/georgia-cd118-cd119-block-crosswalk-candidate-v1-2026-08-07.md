# Georgia CD118 to CD119 block crosswalk candidate v1

## Outcome

This reviewer-only candidate compares the complete Georgia state files extracted deterministically from the retained official Census CD118 and CD119 Block Equivalency File bundles. Both plans contain the same 232,717 unique 2020 Census tabulation blocks across districts 01–14. Exactly 34,108 blocks change district assignment.

| Disposition | Source districts | Count |
|---|---|---:|
| `exact_block_membership_candidate` | 01, 02, 03, 08, 12 | 5 |
| `crosswalk_review_required` | 04, 05, 06, 07, 09, 10, 11, 13, 14 | 9 |

An exact candidate requires equality of the full source and same-number target block sets. No overlap threshold or majority rule is used. Split rows remain review-required regardless of retention percentage, and the package never chooses an alternate target district. Census's retained authority page independently identifies Georgia as a state that redrew for the 119th Congress.

The complete source-to-target matrix retains zeroes as well as nonzero splits. That makes the critical incumbent-history boundary explicit: source CD118-07, the 2022 Lucy McBath contest district, contributes zero blocks to current target CD119-06. The crosswalk therefore cannot turn her separately supported person-identity relationship into a geography relationship. It also does not select CD119-13 or CD119-04 based on larger raw block counts.

Block counts mean only 2020 Census tabulation blocks. They are not population, voter, turnout, partisan, or electoral weights, and the package does not assess raw-geometry equality.

## Lifecycle and provenance

All five exact relationships remain candidates rather than approvals. Every row has `compatibilityApproved: false`, `scoreEligible: false`, and evaluator exclusion. Package review, reviewer identity, review timestamp, and inherited decision resolution remain null; publication eligibility is false.

The artifact has exactly three direct parents: the retained Census CD119 plan-change authority, the derived Georgia CD118 state extract, and the derived Georgia CD119 state extract. Each extract is byte- and hash-bound to its retained national Census bundle through source lock. Validation rejects source bytes, source-lock URL/path/hash/kind/parent topology, block-universe, row semantics, approval, weighting, scoring, reviewer, publication, and unknown-field drift.

## Integrity closure

- Artifact bytes: 43,102
- File SHA-256: `b485a7dc92a37d00fc84c88dd583cada37edb21a501bfb69d69959e2c6270741`
- Package SHA-256: `f79e588ca24be585665d345400456dfa604dc806e7ca465fd7dece874d5310a8`
- Row-set SHA-256: `9921959d244b269279e666c296c3024da7789a7510ab0775d1421e43bbbd3ebe`

## Reproduction

```bash
npm run generate:ga-cd118-cd119-block-crosswalk-v1
npx vitest run src/ingestion/elections/georgia-cd118-cd119-block-crosswalk-candidate.test.ts
npm run typecheck
npm run data:verify
```
