# Connecticut House Democratic primary event dispositions — 2026-08-05

## Status and exact claim

This reviewer-only candidate retains exact public GraphQL request/response receipts from the Connecticut Secretary of the State historical election database for the August 9, 2022, and August 13, 2024 statewide primary events. The selected events advertise 17 and 22 results respectively; page-one enumerations with size 100 return exactly 17 and 22 unique results. Neither complete event contains a row whose event type is `Democratic Primary` and whose office is `Representative in Congress`.

The resulting ten CT-01 through CT-05 district-cycle rows say only `no_reported_democratic_house_primary_contest_in_complete_official_event`. They do **not** say no Democratic nominee, no primary ballot, uncontested nomination, or zero votes. Nomination disposition, selected contest, vote values, and every evaluator value remain null.

## Exact receipt

- Retained GraphQL responses: **4** (two discovery and two complete enumeration responses)
- Official August primary events: **2**
- Advertised and enumerated results: **17/17** in 2022 and **22/22** in 2024
- Enumerated results overall: **39**
- Reported Democratic U.S. House results: **0**
- District-cycle disposition rows: **10**
- Evaluator numeric values and score-eligible rows: **0**
- Disposition-set SHA-256: `5b2f083f3e693d78a7b4b232a7c677007e6c65eb9259109d59c8e45137cc3dcf`
- Package SHA-256: `7dcaf4cea0d1a817ff863010bfc2c3fd45cafc1880f8ff2c3951cdf6b81cc257`
- File SHA-256: `9b536a55c52c4db79f9e734b312be7066704c2bc24a5d82df249662546a58ff6`

The receipt binds the exact POST bodies, content headers, tenant header, request hashes, raw response hashes, event tuple, page-one pagination, event result cardinality, unique result IDs, and result-set hashes. The 2024 discovery response also contains an April primary event, so selection requires the exact August 13 event ID, name, year, and count rather than assuming a single yearly primary.

## Authority and remaining gates

The State SOTS result landing links the historical database, whose about page says it searches results from official source documents. The public GraphQL endpoint is frontend-observed and undocumented, so exact response bytes are retained and endpoint stability is not assumed. No explicit reuse license or separate final canvass/certification artifact is retained.

Before a per-district nomination disposition or score can exist, the project still needs official ballot or nomination authority, independent final certification, current-incumbent candidate identity review, historical-geography review, progressive classification where required, human data review, and explicit publication approval.

## Reproduction

```bash
npm run fetch:ct-house-primary-event-results
npm run generate:ct-house-primary-event-dispositions
npx vitest run src/ingestion/elections/connecticut-house-democratic-primary-event-dispositions-receipt.test.ts
npm run data:verify
npm run typecheck
```
