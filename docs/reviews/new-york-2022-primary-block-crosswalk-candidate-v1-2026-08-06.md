# New York 2022 primary block crosswalk candidate v1

## Outcome

This reviewer-only candidate compares the complete retained 2022 New York congressional assignment with the current Census CD119 New York Block Equivalency File by exact 2020 Census tabulation-block GEOID. Both sides contain the same 288,819 blocks. Of those, 262,938 retain the same district number and 25,881 change district assignment.

The candidate binds exactly the 19 existing `ny:geography:2022:DD` rows in the New York geography v1 parent. It does not rewrite that parent or the existing joint reviewer package.

| Disposition | Districts | Count |
|---|---|---:|
| `exact_block_membership_candidate` | 04, 05, 12, 13 | 4 |
| `crosswalk_review_required` | 03, 06, 07, 08, 09, 10, 14, 15, 16, 18, 19, 20, 22, 25, 26 | 15 |

An exact candidate requires equality of the full source and target block sets, a single source-to-target destination, equal source and target block counts, and both source retention and target coverage of 1,000,000 parts per million. Every split row remains crosswalk-review-required regardless of how high its same-number overlap is. Repeated district numbers, majority overlap, raw geometry, and thresholds cannot promote a row.

Each split partitions every source block and uses deterministic largest-remainder apportionment so its shares sum to exactly 1,000,000 ppm. These are block-count shares only—not population, voter, partisan, or electoral weights. The package does not infer population continuity.

## Lifecycle and reviewer decision

The recommended reversible decision is to accept the four identical-membership rows as compatibility candidates while retaining all fifteen split rows for review. Acceptance would permit a later New York geography package to consume those four candidates; it would not approve them. Rejection leaves all 19 historical rows at `redraw_crosswalk_required`.

Every row remains `compatibilityApproved: false`, `identityApproved: false`, `scoreEligible: false`, reviewer-only, unpublished, and excluded from the evaluator. The parent identity and result dispositions are preserved verbatim. Reviewer identity, resolution, and timestamp remain null.

The artifact has exactly three direct parents: New York geography candidate v1, the 2022 block-assignment receipt, and the retained Census CD119 New York BEF extract. Validation rejects parent, source-lock, block-universe, row, set, package, lifecycle, approval, scoring, and unknown-field drift.

## Integrity closure

- Artifact bytes: 41,967
- File SHA-256: `c32be7bff97fc9c26342c3f03830676dddb2d0058c7b204ce53ee1d34b2c2e33`
- Package SHA-256: `f13dce59a56dce2e34e223601828b4ff29886f1c090a391682d205de0b9077af`
- Row-set SHA-256: `c3b4a7ca00b3658832a9884d97f937d3b2ab2223501e054fda99370eca89cbc5`

## Reproduction

```bash
npm run extract:ny-cd119-bef
npm run generate:ny-2022-primary-block-crosswalk-v1
npx vitest run src/ingestion/elections/new-york-2022-primary-block-crosswalk-candidate.test.ts
npm run data:verify
```
