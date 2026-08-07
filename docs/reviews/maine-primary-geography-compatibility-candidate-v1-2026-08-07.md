# Maine primary geography compatibility candidate v1 — 2026-08-07

## Outcome

This reviewer-only candidate joins all six Maine incumbent-identity observations to the six immutable geography-authority rows. It proposes six historical-geography compatibility relationships:

- 2022 ME-01 and ME-02 use congressional session 118 and historical GEOIDs `2301`/`2302`, supported by the enacted plan and identical complete CD118/CD119 Census block assignments.
- 2024 ME-01 and ME-02 use session 119 and the same exact CD119 inventory keys.
- 2026 ME-01 and ME-02 use session 120 with `historicalGeoid: null`. They are state-law continuing-plan candidates only; no Census CD120 geometry or exact CD120 GEOID is retained or inferred.

Every row remains geography-unapproved, identity-unapproved, evaluator-null, score-ineligible, unpublished, and undeployed.

## Identity/result preservation

The geography join does not alter identity or result semantics. In particular, the 2026 ME-02 row retains Jared Golden's current-incumbent source nonappearance, a null linked source candidate and votes, Matthew G. Dunlap's explicit RCV source-winner fact, and the unresolved 81-vote workbook/central-count round-one difference. Dunlap is not linked to Golden, and the row creates no incumbent winner, loss, retirement, withdrawal, nomination, or evaluator conclusion.

## Geography evidence boundary

The 2022 relationship is based on exact normalized block-to-district assignment identity between the complete Census CD118 and CD119 Maine extracts, not raw coordinate or geometry equality. The retained enacted plan has not been directly block-crosswalked to the Census layer, so exact source-plan-to-layer concordance remains unassessed.

The 2026 relationships are supported by the enacted “2022 and thereafter” rule, current codification, and decennial review cadence. `cd120CensusGeometryRetained` remains false, `noCd120CensusGeoidInferred` remains true, and the historical GEOID remains null. Those rows therefore do not masquerade as Census CD120 exact-key candidates.

## Provenance and pins

The exact four direct parents are the source-selection proposal, Maine result receipt, Maine identity candidate, and Maine geography-authority receipt. Raw workbooks, plan law, statutes, Census bundles/extracts, and TIGER archive remain bound through those immutable parents.

- artifact bytes: `20729`
- file SHA-256: `da85b195e8c98e04575121a2a816c1c779724a6459e7cc5f5863603676c3131e`
- package SHA-256: `12d8fbc3142a2704bcb21e9ea169276d135fcda98d401c2c0b95e79ad27474f3`
- row-set SHA-256: `f67496dfbab0fb9ca222be2bc463abd2546f0810ad8c467a6388a26d49f73e6d`

## Reproduction

```bash
npm run generate:me-primary-geography-compatibility-v1
npx vitest run src/ingestion/elections/maine-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The validator reconstructs the entire expected package from the exact immutable parents and canonically compares it to the supplied artifact. Parent drift, row/hash substitutions, CD120 escalation, reviewer or approval fabrication, scoring, publication, and unknown fields are rejected.
