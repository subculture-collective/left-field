# Connecticut general-election Statements of Vote source receipt — 2026-08-06

## Retained authority

The repository retains the exact official Connecticut Secretary of the State Statements of Vote for the November 8, 2022 and November 5, 2024 general elections.

| Cycle | Pages | Bytes | SHA-256 |
|---|---:|---:|---|
| 2022 | 137 | 2,290,328 | `1b6ca3708890241c387320e68b5e628f27a3bbc08b83b0d172e5d7bd9183664b` |
| 2024 | 170 | 3,139,465 | `1043dc18895adcff95e227e136eb19ef1c65f2a452a4dc97105fb4738cf3751c` |

Both publications contain party-labeled, district-specific U.S. House result tables for districts 1–5. The Democratic columns name John B. Larson, Joe Courtney, Rosa L. DeLauro, Jim Himes, and Jahana Hayes. The 2024 publication additionally contains a Board of Canvassers declaration naming those five people elected to the 119th Congress.

## Evidence boundary

This commit retains source authority only. It does not itself promote a nominee, result, winner, identity, geography relationship, evaluator value, score, publication state, or deployment. A separate deterministic reviewer receipt must bind exact table observations, party labels, vote totals, row reconciliation, and any cycle-specific canvass declaration. The receipt must not project the 2024 elected declaration backward onto 2022 or treat general-election appearance alone as statutory proof of the earlier primary disposition.

The PDFs contain election returns and no residential-address candidate filing fields were observed in the relevant House tables. The fetcher pins URL, byte size, and SHA-256 and refuses source drift or conflicting existing output.

```bash
npm run fetch:ct-general-statements
npm run test:run -- scripts/fetch-connecticut-general-election-statements.test.ts
npm run data:verify
```
