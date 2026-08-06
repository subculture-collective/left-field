# Oregon primary geography compatibility candidate v2

Date: 2026-08-06

Status: proposed reviewer-only geography evidence; unapproved, score-ineligible, publication-ineligible

This package composes immutable geography v1 with the Oregon 2026 authority receipt. It preserves the six CD118-to-CD119 and six exact-CD119 candidates, then changes exactly the six 2026 districts 01–06 from authority-pending to current-official-plan continuity candidates.

The 2026 rows retain Congress session `120` and `historicalGeoid: null`. Their evidence records that the current LPRO layer is based on the September 27, 2021 adopted plan and that a complete Census CD119 district inventory is retained. It does not claim a Census CD120 product, exact source-plan-to-CD119 block concordance, raw geometry equality, direct 2026 election-administration confirmation, or legal permanence.

All 18 relationships remain compatibility-unapproved, identity-unapproved, evaluator-excluded, score-ineligible, reviewer-only, unpublished, and undeployed. The package creates no decision closure or numeric evaluator value.

```bash
npm run generate:or-primary-geography-v2
npx vitest run src/ingestion/elections/oregon-primary-geography-compatibility-candidate-v2.test.ts --maxWorkers=1
npm run data:verify
```

Artifact: 28,888 bytes; SHA-256 `bde02ed6eee2bfd85b61a892bb7686ff703ea2bebcc32ce652317b76bbe9994b`; package SHA-256 `b8f27af5d9436426d520e94eca574ea39aa72fd256d7b72f8f879f88087d301f`; row-set SHA-256 `bfa5a42eca7a4454739b721bfe963fddff66ea117dce35588b1953c6e06a5c70`.
