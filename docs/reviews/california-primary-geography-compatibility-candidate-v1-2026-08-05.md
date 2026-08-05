# California primary geography compatibility candidate v1

Status: **proposed reviewer evidence; nonpublishable, top-two-formula-incompatible, and excluded from evaluation**

This package accounts for every district-cycle observation in the certified California House top-two receipt without approving a geography relationship, identity, contest selection, evaluator value, score, or publication state. It informs the existing unresolved `approve-historical-district-cd119-compatibility-v1` decision and creates no decision of its own.

## Evidence and result

The retained Census Block Equivalency File page identifies Alabama, Georgia, Louisiana, New York, and North Carolina as the states that redrew congressional plans for CD119; California is absent. Exact official California TIGER archives independently close all 52 district keys for CD118 and CD119.

| Cycle | Session boundary | Candidate disposition | Rows |
| --- | --- | --- | ---: |
| 2022 | CD118 to CD119 | Official no-redraw declaration plus the same state/district key in both official inventories | 52 |
| 2024 | CD119 | Exact same-session California district key | 52 |
| 2026 | CD120 | Authority pending; CD119 is not silently carried forward | 52 |

The first two groups produce 104 high-confidence compatibility **candidates**. All 156 rows retain `compatibilityApproved: false`, `identityApproved: false`, `scoreEligible: false`, and `formulaApplicability: confirmed_incompatible_with_party_primary_metrics`. The 52 CD120 rows have null historical GEOIDs and no compatibility candidate.

The continuity claim is deliberately limited to the official Census redraw scope plus complete district-key inventories. It is not raw geometry equality, an overlap calculation, identity review, a Democratic nomination, or permission to derive top-two advancement. Coordinate or ZIP-byte differences are not treated as plan changes.

## Immutable evidence

- California CD118 TIGER ZIP SHA-256: `7b53f26c7650090b75ef7af3d7087eaea2d62c4a3a3bd38b7dd2ac3a79c789b5`
- California CD119 TIGER ZIP SHA-256: `107a5178d53c1c741b5e0fac48295a5f7a9424d516e246a44a34667c111c5481`
- Candidate artifact SHA-256: `26bf6010c411d6895c6d307788ec203e75ad1e60f947773ac9ed6283ddccb8c6`
- Package SHA-256: `59ee4593076e81829dbb576f70230b0c50744d473c80c57b050ce5e9884b3f94`
- Row-set SHA-256: `ea829f1b57dc8f494676d9a9991546e9d08887eaf36cd06e422339d27519dcea`

The exact parents are the unresolved source-selection proposal, California top-two receipt, retained Census CD119 plan-change authority, and official California CD118/CD119 TIGER archives.

## Reproduction and review consequence

```sh
npm run generate:ca-primary-geography-v1
npm run test:run -- src/ingestion/elections/california-primary-geography-compatibility-candidate.test.ts
npm run data:verify
npm run typecheck
```

Recommended decision support: accept the 104 rows as strong evidence candidates for the existing historical-geography decision while retaining independent human review and every top-two evaluator exclusion. If the reviewer rejects the Census plan-continuity rule, the safe default remains exclusion pending a separately reviewed official block-level crosswalk. CD120 remains pending under either choice.
