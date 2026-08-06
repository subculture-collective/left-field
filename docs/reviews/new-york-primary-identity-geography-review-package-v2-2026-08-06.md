# New York primary identity/geography joint reviewer package v2

## Outcome

This composition-only reviewer package retains joint v1 as immutable evidence and recomposes its exact 38 records with geography v2. It is the preferred review entry point for the new block-grain evidence, but it does not resolve or alter any parent decision.

The seven mutually exclusive review categories close exactly:

| Category | Records |
|---|---:|
| 2022 identity and exact-block candidates | 2 |
| 2022 exact-block candidate, identity not applicable | 2 |
| 2022 identity candidate, block crosswalk pending | 6 |
| 2022 block crosswalk pending, identity no-match | 4 |
| 2022 block crosswalk pending, identity not applicable | 5 |
| 2024 identity and geography candidates | 4 |
| 2024 geography candidate, identity not applicable | 15 |

The package therefore exposes four historical exact-block candidates, fifteen historical split rows, nineteen current session/key geography candidates, twelve identity candidates, sixteen reported-contest records, seven certified-uncontested records, and fifteen unresolved records. It preserves every v1 identity, contest, result, certification, source-winner, and progressive-classification boundary.

Five independently scoped proposed decisions cover historical geography, identity, primary disposition, progressive classification, and reported-result authority. The geography recommendation retains the four block-exact findings as candidates only, preserves all fifteen split rows as pending, and leaves the nineteen 2024 candidates unchanged. Every decision retains null reviewer, resolution, and timestamp.

No record is jointly approved, geography-approved, identity-approved, crosswalk-approved, score-eligible, evaluator-eligible, published, or deployed. The package explicitly makes no legal-effect or election-use conclusion for the LATFOR plan, and block counts are not treated as population, voter, partisan, or electoral weights.

## Lineage and supersession

The exact direct parents are joint reviewer package v1 and geography candidate v2. Supersession is limited to the preferred joint reviewer composition: parent evidence and review state remain preserved, and no parent decision is resolved.

## Integrity and reproduction

- Artifact bytes: 135,262
- File SHA-256: `9bd59eeca6d214701a7b36f1f2f6f2689d7d2a1499af34ede818893cce7f87f4`
- Package SHA-256: `42ad411c5da544ea75bb1e164efa453de659dbe1254d9388ea919a1f2bf4047c`
- Record-set SHA-256: `1a3c6b7fd214432c89443aacbfa97d19add95ef7f759d087b7686a31ae51b897`
- Decision-set SHA-256: `da2f425b4810df9a2c7d65129d838d8cdee3c2c9f8052e9dfa323347ca8540f7`

```bash
npm run generate:ny-primary-joint-review-v2
npx vitest run src/ingestion/elections/new-york-primary-identity-geography-review-package-v2.test.ts
npm run data:verify
```
