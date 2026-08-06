# Massachusetts primary geography compatibility candidate v1

Date: 2026-08-05
Status: proposed reviewer-only geography evidence; not approved, score-bearing, published, or deployed

## Result

The candidate accounts for every retained Massachusetts target contest: districts 01–09 in both 2022 and 2024, for 18 rows total.

| Cycle | Evidence | Rows | Disposition |
| --- | --- | ---: | --- |
| 2022 | Official Census CD119 redraw declaration excludes Massachusetts; exact CD118 and CD119 inventories both contain GEOIDs 2501–2509 | 9 | `official_no_plan_change_declaration_same_geoid_key_candidate` |
| 2024 | Contest and target geography both use the 119th Congress; exact CD119 inventory contains GEOIDs 2501–2509 | 9 | `same_cd119_session_and_geoid_exact_key_candidate` |

Every row is a high-confidence compatibility candidate, not an approval. The method does not compare raw shape coordinates, calculate overlap, or establish population equivalence. Matching district numbers alone are not the evidence; the candidate requires the exact Census authority statement and complete official CD118/CD119 inventories.

## Lifecycle boundary

The artifact informs the unresolved `approve-historical-district-cd119-compatibility-v1` decision and does not resolve it. It does not approve the separate identity candidate. Every row has `compatibilityApproved: false`, `identityApproved: false`, and `scoreEligible: false`, with evaluator use excluded pending authorized identity, historical-geography, and review decisions.

The source receipt contains no 2026 result contest because the September 1, 2026 primary was after the August 5 cutoff. This package therefore emits zero 2026/CD120 rows and makes no CD119-continuity assumption for a future election.

## Immutable identities

- Artifact: `data/metadata/massachusetts-primary-geography-compatibility-candidate-v1.json`
- Byte size: `22,485`
- File SHA-256: `f74670eca7741c0fb000a61a623c6ece845f3da203cabb53644b8383a4e69174`
- Row-set SHA-256: `9dc75c5963c0467adaa684723a82792a50eb9435e4a1d3abf32d2c7dd6c7c2e1`
- Package SHA-256: `7b73e142ec8a6d8024b5845bd0d19eda4569b69a72a03dc83edcb7d231bd11c1`

The builder recomputes hashes over the authority HTML, both raw TIGER ZIPs, and both extracted DBFs. It validates exact ordered source-lock lineage and complete district inventories. The validator pins all 18 parent contest ID/hash pairs, evidence categories, row hashes, the row-set hash, and the package hash; it rejects unknown fields and fully rehashed semantic substitution.

## Reproduction

```bash
npm run generate:ma-primary-geography-v1
npm run test:run -- src/ingestion/elections/massachusetts-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```
