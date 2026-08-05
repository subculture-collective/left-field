# North Carolina primary geography compatibility candidate v1

Status: **proposed reviewer-only block crosswalk; not approved, published, or evaluator-eligible**

The candidate joins all 12 North Carolina target identity observations to the exact election plan used in 2022, 2024, or 2026 and compares it with the current CD119 target plan on a common universe of 236,638 unique 2020 Census tabulation blocks. The raw Census CD119 block-equivalency bundle and its exact North Carolina extract are retained and hash-bound.

Seven rows have identical source-plan and target-plan block membership: all four 2024 target districts, plus districts 2, 4, and 12 in the 2025 plan used for the 2026 election. They are high-quality compatibility candidates but remain unapproved. The other five rows—all four 2022 target districts and 2026 district 1—split across current districts and remain `crosswalk_review_required` with no compatibility candidate.

Every split row serializes its complete source-to-target district block counts, source-retention parts per million, and target-coverage parts per million. Each PPM value is independently rounded to the nearest integer, so the sum of split shares may differ from 1,000,000 by at most one PPM. These are counts of geographic tabulation blocks, not people, voters, precinct votes, or population-weighted overlap. No threshold converts a split into a compatible relationship.

The largest changes among target observations are visible rather than hidden. The 2022 district 12 block set retains 3,729 of 9,384 blocks in current district 12 and also maps into current districts 14, 6, and 8. The 2025-plan district 1 used in 2026 retains 15,937 of 26,755 blocks in current district 1 and maps 10,818 blocks into current district 3.

All rows remain geography-unapproved, identity-unapproved, score-ineligible, reviewer-only, unpublished, undeployed, and excluded from evaluator use. Reproduce with:

```sh
npm run fetch:nc-primary-current-geography-bef
npm run generate:nc-primary-geography-v1
npm run test:run -- src/ingestion/elections/north-carolina-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
