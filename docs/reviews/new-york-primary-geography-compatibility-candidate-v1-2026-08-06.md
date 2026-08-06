# New York primary geography compatibility candidate v1

## Outcome

This reviewer-only candidate binds all 38 New York current-target identity observations to complete official CD118 and CD119 Census district inventories while preserving the Census declaration that New York redrew its congressional plan for the 119th Congress.

The resulting treatment is deliberately asymmetric:

| Historical cycle | Rows | Geography treatment |
|---|---:|---|
| 2022 / CD118 | 19 | `redraw_crosswalk_required`; no compatibility candidate |
| 2024 / CD119 | 19 | `same_cd119_session_and_geoid_exact_key_candidate` |

All 19 2022 rows retain their historical CD118 GEOID for auditability, but a matching numeric district and GEOID suffix does not establish continuity into the redrawn CD119 plan. The repository has no retained authoritative 2022-plan assignment at the same Census-block grain as the current CD119 block-equivalency file, so no overlap, equivalence, or threshold relationship is proposed.

All 19 2024 rows share the CD119 congressional session and have exact state/district keys in the complete official CD119 inventory. This supports a high-confidence exact session/key candidate only. It is not a claim of raw geometry equality, population equivalence, candidate identity approval, result selection, or evaluator eligibility.

## Preserved identity and result states

The geography rows preserve the identity package’s exact partition:

- 12 proposed identity links;
- four reported-contest predecessor no-matches;
- 22 observations with no reported candidate identity evidence.

They also preserve all 16 reported, seven certified-uncontested, and 15 unresolved result dispositions, including the separate statewide and NYC authority statuses. Composition establishes no source winner. Every row remains `compatibilityApproved: false`, `identityApproved: false`, and `scoreEligible: false`.

The recommended reversible reviewer treatment is to accept only the 19 exact 2024 session/key candidates and retain all 19 2022 rows as crosswalk-required. The package and source-selection decision retain null reviewer, resolution, and timestamp. Publication and deployment remain ineligible.

## Source and integrity closure

Both official TIGER DBF inventories contain exactly 26 numbered New York districts and no special rows:

- CD118 ZIP SHA-256: `038a6cc7a89bd9833d9698993683628c82598a085e87093bbd978af7454dd7fa`
- CD118 DBF SHA-256: `f53ed96ec308887bf14b6b829deefbae6ecaa23027da40a6ae3bb6fdabbaf91f`
- CD119 ZIP SHA-256: `0955e0f7060dd43af98d939cbabb10df578901184472cbba57c91518c52991c7`
- CD119 DBF SHA-256: `2d603cef159f14ef771f453f5acbe5155816dd41649acbc1a6c130f0f11f5586`

The generated artifact is 67,071 bytes with file SHA-256 `8f0410959243684b03a2575eb989d23839854c17d3b4b4fe4e6416be932f5096`, package SHA-256 `c5839d2fb9dd4cc6f463a3adf2520a43b1c6484e2f7d95c6b2e1eb0470611b5d`, and row-set SHA-256 `81d251dbbc6bbd9c1e3185abb7e161ab01b0332ec8439df69edb02a739aa85fb`.

The output has exactly six direct parents: source-selection proposal, New York v2 dispositions, New York identity candidate, Census CD119 plan-change authority, New York CD118 TIGER archive, and New York CD119 TIGER archive.

## Reproduction

```bash
npm run generate:ny-primary-geography-v1
npx vitest run src/ingestion/elections/new-york-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
