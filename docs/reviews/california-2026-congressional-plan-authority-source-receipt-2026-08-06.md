# California 2026 congressional plan authority source receipt

## Outcome

This source receipt retains the official evidence needed to evaluate California's 2026 congressional geography without substituting the 119th-Congress districts for the Proposition 50 / AB 604 plan.

The current California Secretary of State redistricting page says voters approved Proposition 50 on November 4, 2025 and that California will use the legislatively drawn congressional districts for elections beginning in 2026. It distinguishes electoral use from representation: the 2026 primary and general-election ballots use candidates for the new districts, while voters remain represented under the former districts until noon on January 3, 2027. The statement is retained at the 2026-08-06 source cutoff; this receipt does not infer legal status beyond that cutoff.

The official Proposition 50 voter guide says the measure replaces the current congressional maps with legislatively drawn maps for congressional elections starting in 2026 and directs readers to AB 604 for the census-block descriptions. The California Senate Office of Demographics identifies those districts as established by Proposition 50, identifies AB 604 as Chapter 96, Statutes of 2025, and links the official AB 604 district-equivalency CSV.

## Block evidence

The official `ab604.csv` has no header and begins with a UTF-8 byte-order mark. It contains exactly 519,723 two-column records. Each record assigns one unique 15-digit California 2020 Census tabulation-block GEOID to a zero-padded district from `01` through `52`. The deterministic normalized extract adds the `GEOID,CDFP` header and sorts records by GEOID.

The retained Census CD119 national Block Equivalency File supplies the comparison layer. Its deterministic California extract contains the same 519,723 unique blocks and the same complete `01` through `52` district inventory. The block universes are exactly equal; 133,426 blocks have different AB 604 and CD119 district assignments. Block counts are not population, voters, turnout, or partisan weights.

| Retained input | Bytes | SHA-256 |
|---|---:|---|
| Secretary of State current redistricting page | 62,964 | `37c47e69d57a1fa134313ff6a46a5d416d7970881f8d1e6735f94cf27e5a19fd` |
| Official Proposition 50 voter guide | 4,872,403 | `245e774a9b1f860585043fca34a33602c3c1c07b73d0332b710d217d54e4fd22` |
| Senate Office of Demographics 2025 congressional-district source page | 87,789 | `fab27772b3385efa15bd0c21a23892a513a4ea1426c1d0b5d7d6e9d68bd87a5e` |
| Official AB 604 district-equivalency CSV | 12,473,355 | `ac11292bf0e862a0b2716dc687a9eb91fdc4b480ae115c0a21848f3fbd7173b2` |
| Normalized AB 604 California block extract | 10,394,472 | `280f47703360ac4c9c59341a6a4317fe039ad4d20173cc4f00bfc9438e0505fc` |
| Census CD119 California block extract | 10,394,472 | `f9c68edcf53483aa1c83315180bcc5d88b1db0b55869c443f755e1dcd61fcfc4` |

The official source pages state no separate license or reuse grant for the equivalency file. The repository records public governmental access and provenance but does not claim a formal open-data license or publication permission.

This is a source-only slice. It changes no identity relationship, geography candidate, approval, top-two formula applicability, evaluator value, score, publication, deployment, or reviewer resolution.

## Reproduction

The deterministic reproduction route uses the retained official-response cache. This is necessary because the Secretary of State page injects a volatile telemetry timing value into otherwise unchanged HTML. A live fetch remains available as a strict byte-drift detector and may fail on telemetry-only drift; a changed live response must be reviewed before replacing the retained snapshot.

```bash
DSA_SEATS_CA_2026_PLAN_AUTHORITY_CACHE_DIR=data/source/elections/primary-results/geography/california/2026 npm run fetch:ca-2026-congressional-plan-authority
npx vitest run scripts/fetch-california-2026-congressional-plan-authority.test.ts
npm run data:verify
```

Live strict drift check:

```bash
npm run fetch:ca-2026-congressional-plan-authority
```

The next deterministic step is a 52-observation AB 604-to-CD119 block crosswalk. Exact whole-block membership is the only allowed compatibility-candidate rule; split relationships remain review-required without a threshold inference.
