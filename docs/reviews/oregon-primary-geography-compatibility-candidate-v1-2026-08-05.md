# Oregon primary geography compatibility candidate v1

Status: **proposed reviewer-only geography evidence; not approved, published, or evaluator-eligible**

The candidate closes all 18 Oregon House primary contest observations against exact Census authority:

- six 2022 CD118 rows are high-confidence continuity candidates because Oregon is absent from the official five-state CD119 redraw list and each `41xx` district key exists in both exact CD118 and CD119 inventories;
- six 2024 rows are high-confidence exact same-session CD119 key candidates;
- six 2026 rows remain `unassessed_cd120_authority_collection_pending`, with null historical GEOIDs and no compatibility candidate.

The CD118 and CD119 DBF inventories each contain exactly Oregon districts 01–06 and are extracted from source-locked official TIGER ZIPs. This is key and official plan-continuity evidence, not a raw geometry equality or overlap calculation. All 18 rows remain identity-unreviewed, compatibility-unapproved, score-ineligible, reviewer-only, and publication-ineligible. Automatic approvals and evaluator numeric values are both zero.

```sh
npm run fetch:or-primary-geography-authority
npm run generate:or-primary-geography-v1
npm run test:run -- src/ingestion/elections/oregon-primary-geography-compatibility-candidate.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `8e8354e5dd6ddabcf3a97c3049015556b7262a0308df9d9e2cc3aae2995b06be`

Row-set SHA-256: `c57f4f405d4806eb05687a8ecd85cd5b26f2225dd502adfd54386724b71c32a0`
