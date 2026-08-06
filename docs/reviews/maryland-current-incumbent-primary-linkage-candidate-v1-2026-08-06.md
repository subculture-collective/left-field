# Maryland current-incumbent primary linkage candidate v1

## Outcome

This reviewer-only candidate closes the exact current-target universe of seven Maryland Democratic U.S. House seats across the retained 2022 and 2024 State Board primary result cycles. Its 14 reported contest observations account for 84 candidate rows and 1,210,215 candidate votes.

It proposes 11 current-incumbent candidate relationships: six exact normalized official-name observations and five narrowly documented derived relationships. Three 2022 observations remain explicit no-matches because the reported candidates belong to the predecessor contests for current incumbents Johnny Olszewski, Sarah Elfreth, and April McClain Delaney. MD-01 is outside the current Democratic target roster. No 2026 row is retained or inferred.

## Finite relationship matrix

- Exact normalized names: 2022 MD-07 and MD-08; 2024 MD-03, MD-06, MD-07, and MD-08.
- Source middle initial absent from the Clerk official name: Glenn F. Ivey in 2022 and 2024 MD-04.
- Clerk middle initial absent from the source name: Steny Hoyer in 2022 and 2024 MD-05.
- One specifically constrained quoted-nickname relationship: 2024 MD-02 source candidate `John "Johnny O" Olszewski, Jr.` to Clerk official name `Johnny Olszewski, Jr.`.
- Explicit no-match: 2022 MD-02, MD-03, and MD-06. Ruppersberger, Sarbanes, and Trone are not cross-linked to their current successors.

The implementation uses this finite audited table. It does not use fuzzy matching, broad nickname inference, vote rank, or a winner marker to establish identity.

## Authority and lifecycle boundaries

The candidate preserves `state_board_official_result_candidate` for all 14 observations and `not_independently_retained` for the separate signed-or-sealed certification boundary. All 11 matched source candidates happen to carry the State Board's winner marker. That marker remains only a source fact: it is not an identity approval, geography approval, reviewer decision, evaluator selection, publication promotion, or score input.

Every row remains `identityApproved: false` and `scoreEligible: false`. The package and inherited source-selection decision remain proposed with null reviewer, resolution, and timestamp. Historical district geography, progressive classification, final human review, and publication approval remain unresolved. The safe default excludes all observations from the evaluator.

## Reproduction and integrity

```bash
npm run generate:md-current-incumbent-primary-linkage-v1
npx vitest run src/ingestion/elections/maryland-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
```

The artifact is 34,294 bytes with file SHA-256 `632a49ca04113a66b075ac2fe5e9ac37c0af03d52d908297ac77316411f71324`. Its package SHA-256 is `c79fd8233aecd8ff2f2c0cb5cde0a7834df27bf818de1c346848d57727b4f16f`, observation-set SHA-256 is `cb22b245da751503939a3b778cb9941696b815b6930da24359c85f2e94938269`, and parent-projection SHA-256 is `7c6eee50760b4575d9bab1ae9def4c0a8680636b4a3e8d2d48160652881626fb`.

The output source-lock entry has exactly five direct parents: the current target roster, the primary source-selection proposal, the House Clerk source, the Congress Legislators source, and the Maryland primary-results receipt. Validation rejects source-lock or parent drift, row/set/package hash drift, cardinality drift, inherited-gate drift, and fully rehashed attempts to fabricate approval or reviewer state.
