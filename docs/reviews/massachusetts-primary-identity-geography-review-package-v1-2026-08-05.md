# Massachusetts primary identity/geography review package v1

Date: 2026-08-05
Status: proposed reviewer queue; not approved, evaluator-eligible, score-bearing, published, or deployed

## Review matrix

The package joins all 18 Massachusetts identity observations one-to-one with their matching geography rows on contest ID, contest hash, seat-cycle ID, district, and cycle. Every record has an identity candidate and a geography candidate pending independent review. Zero records are identity-approved, geography-approved, jointly approved, evaluator-eligible, or score-eligible.

The package also preserves the parent receipt's narrow treatment of each PD43+ result: one printed candidate plus separate `All Others` and blank-vote channels is a reported contest, not an inferred uncontested primary.

## Proposed decisions

| Decision | Recommendation | Safe reversible default |
| --- | --- | --- |
| `ma-primary:accept-identity-links-v1` | Accept all 18 exact or retained-alias same-district identity relationships while preserving the absence of a direct PD43+ person identifier. | Exclude affected records from evaluator use and publication. |
| `ma-primary:accept-geography-compatibility-v1` | Accept nine CD118-to-CD119 continuity candidates and nine exact CD119 session/key candidates without claiming raw geometry equality. | Exclude affected records from evaluator use and publication. |
| `ma-primary:retain-single-named-reported-contest-treatment-v1` | Keep all 18 as reported contests and do not infer uncontested status from one printed candidate. | Exclude affected records from evaluator use and publication. |

Each decision binds the exact same 18 affected review records because identity, geography, and disposition are independent gates on every row. Each includes two alternatives, two consequences, high confidence, completed work, `blocksAffectedPublication: true`, `blocksOtherWork: false`, and a null reviewer resolution. Resolving one decision cannot mutate or imply resolution of either other decision.

## Immutable identities

- Artifact: `data/metadata/massachusetts-primary-identity-geography-review-package-v1.json`
- Byte size: `50,791`
- File SHA-256: `08d2063b358c510cda2131cec07e6ad775d4f1db784e4161f332f23c85a9322a`
- Parent-projection SHA-256: `0bd8532c35298f884a20dd9095b24768360b1d66d1499430f04106793e082723`
- Review-record-set SHA-256: `224be033db1ca876721191f7cfc95a3b5ee3919d9cba3ed77a2fdf3993ae5791`
- Decision-set SHA-256: `57bf5771cdaefab8e46ec3e9fe1a4a3d00e1b1cdf57b145e9e9faf4021abfaca`
- Package SHA-256: `04e07185560b6fe7e41292c10a2575cfe24fcd8a0b81b87be16e022ff7ddf75f`

The builder recomputes raw parent JSON hashes, validates frozen parent candidates and exact source-lock lineage, and requires one-to-one join closure. The validator pins the joined parent projection, record set, decision evidence sets, decision set, and package hash; it rejects unknown fields, fabricated resolution/approval state, missing or duplicate evidence, and fully rehashed parent-row substitution.

## Reproduction

```bash
npm run generate:ma-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/massachusetts-primary-identity-geography-review-package.test.ts
npm run data:verify
```
