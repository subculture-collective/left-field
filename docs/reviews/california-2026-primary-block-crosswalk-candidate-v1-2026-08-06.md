# California 2026 primary block crosswalk candidate v1

## Outcome

This reviewer-only candidate compares the Proposition 50 / AB 604 congressional plan used for California's 2026 primary and general-election ballots with the current CD119 plan at the complete 2020 Census tabulation-block grain.

Both retained assignments contain exactly 519,723 unique California blocks and all 52 numbered districts. Their block universes are exactly equal, while 133,426 blocks have different district assignments. The candidate binds all 52 existing 2026 top-two contest rows from California geography v1 without modifying the immutable parent.

Four districts have exactly identical source and target block sets and are retained as high-confidence geography compatibility candidates:

- district 34: 4,915 blocks;
- district 36: 8,525 blocks;
- district 37: 5,515 blocks;
- district 43: 6,631 blocks.

The other 48 districts remain `crosswalk_review_required`. No overlap threshold is used. District 12 is an explicit asymmetric-set guard: all 8,894 AB 604 district-12 blocks map to CD119 district 12, but CD119 district 12 contains 8,895 blocks, so the two sets are not identical and no candidate is created. District 41 is also retained without same-number inference: none of its 6,975 source blocks map to CD119 district 41.

## Interpretation boundaries

Each split vector is derived from complete block assignments and uses largest-remainder apportionment to total exactly 1,000,000 parts per million. Block counts and shares are not population, voters, turnout, electoral weight, or partisan performance. Same district numbers and large overlap shares are not continuity rules.

The source authority is time-bounded at 2026-08-06. It establishes use of the Proposition 50 / AB 604 plan for 2026 ballots while preserving the Secretary of State's distinction that representation under the new districts begins at noon on January 3, 2027. The candidate does not assess permanence after the cutoff.

California's top-two contests remain `confirmed_incompatible_with_party_primary_metrics`. All four exact geography relationships are candidates only. Every compatibility approval, identity approval, reviewer identity, review timestamp, score eligibility, evaluator numeric value, publication state, and deployment state remains false, null, or zero as applicable.

## Artifact identity

| Field | Value |
|---|---|
| Artifact | `data/metadata/california-2026-primary-block-crosswalk-candidate-v1.json` |
| Bytes | 128,492 |
| SHA-256 | `7682fbebc52f2c86c83675ceef2c1e5fc6367d8a3a2674b47becda942ec2f044` |
| Package SHA-256 | `c4d1ace29f232c17248f2e348382c45d86f4fa9165d17dc03d47d2d108ab9cfd` |
| Row-set SHA-256 | `969da6503a15a66c144a2d1cc88b26ad095d2f3cc103ac6daf07b9126e109cd8` |

## Reproduction

```bash
npm run generate:ca-2026-primary-block-crosswalk-v1
npx vitest run src/ingestion/elections/california-2026-primary-block-crosswalk-candidate.test.ts --maxWorkers=1
npm run data:verify
```

The next step is immutable California geography v2 composition: preserve all 104 inherited 2022/2024 candidates, replace only the 52 2026 collection-pending interpretations with these four exact candidates and 48 review-required splits, and keep every lifecycle gate closed.
