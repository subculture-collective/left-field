# Florida primary identity/geography joint review package v1

Date: 2026-08-06  
Status: proposed reviewer queue; no approval, evaluator value, publication, or deployment

## Review-record closure

The package joins all 14 Florida identity observations one-to-one with their geography rows for districts 09, 10, 14, 22, 23, 24, and 25 across 2022 and 2024. Parent observation IDs, parent row hashes, contest IDs, contest hashes, cycles, seats, districts, identity dispositions, and authority states must agree.

- Seven records contain both identity and geography candidates.
- Seven records contain a geography candidate while retaining `source_unobserved_district_cycle_unresolved` identity status.
- All 14 contain geography candidates.
- Zero records are jointly approved or score eligible.

The seven source-unobserved records remain 2022 FL-09/22 and 2024 FL-09/14/22/23/24. Their contest IDs, contest hashes, result authority, and certification fields remain null, and geography evidence does not create a contest or identity relationship. The other seven records preserve Florida Division official-extract authority, the official-results flag without a separately retained signed certificate, and `not_marked_by_source`.

## Independent proposed decisions

| Decision | Evidence records | Recommended reversible treatment |
| --- | ---: | --- |
| Accept official-extract authority | 7 | Accept the retained source-authority status without claiming a separate signed certificate or inferring a winner. |
| Accept geography compatibility | 14 | Accept seven CD118 continuity and seven exact CD119 key candidates without claiming geometry equality. |
| Accept identity links | 7 | Accept four exact and three narrowly derived name relationships; retain the other seven as source-unobserved. |
| Retain primary-disposition exclusion | 14 | Preserve reported versus source-unobserved distinctions; do not convert absence to zero or no-primary. |
| Retain progressive-classification exclusion | 14 | Introduce no progressive classification without separate evidence and review. |

Each decision remains `proposed` with null reviewer, review timestamp, and resolution. Each blocks only affected publication and does not block continued acquisition or implementation. The five corresponding parent decision resolutions remain null.

## Integrity and lifecycle

- Artifact SHA-256: `0e5082b077aed8b16e88731827b2eafdff633fba480ba2225d98604a096f5453`
- Package SHA-256: `0c7cbf69db30cbf6eb197873847d7f16967c7de471d23c9e2374a50388f82155`
- Review-record-set SHA-256: `91d0dd537766e07f2aa0d444238fddf513cf71a60fc1e3251237161588922cb4`
- Decision-set SHA-256: `95e941925864e43761d99e556f461f6dcbb4b1c517f16ee963e660be1bfabb44`
- Parent-projection SHA-256: `119601a3b2b4868618523f95671214c320b2b20a062997cffcc948d219895da0`

The exact three direct parents are the source-selection proposal, Florida identity candidate, and Florida geography candidate. The package is reviewer-only and publication-ineligible. It creates no reviewer identity, signature, approval, selection, evaluator value, score, production release, or deployment.

```bash
npm run generate:fl-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/florida-primary-identity-geography-review-package.test.ts
npm run data:verify
```
