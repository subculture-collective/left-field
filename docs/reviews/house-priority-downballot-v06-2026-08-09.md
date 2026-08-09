# House Priority Index down-ballot activation v0.6 — 2026-08-09

## Outcome

V0.6 extends the exact-at-large down-ballot component to South Dakota while preserving the v0.5 values for Delaware and Wyoming. The retained MEDSL South Dakota archive labels the county `OGLALA LAKOTA` but uses obsolete county FIPS `46113`. The retained Census Bureau county-change page states that Shannon County (46-113) changed name and code to Oglala Lakota County (46-102), effective May 1, 2015.

The normalization artifact binds all 18 affected 2024 House `GEN` / `TOTAL` precinct rows and aggregates them into the two source candidates under current FIPS `46102`: Dusty Johnson 720 and Sheryl Johnson 2,313. It does not edit the raw archive or the national v1 county-House projection.

| Seat | House D share | Harris share | Difference | Component | v0.5 → v0.6 |
| --- | ---: | ---: | ---: | ---: | ---: |
| DE-AL | 57.86% | 56.63% | +1.23 pp | 56.2 | 39.7 → 39.7 |
| SD-AL | 27.96% | 34.24% | -6.28 pp | 18.6 | 7.2 → 6.3 |
| WY-AL | 23.24% | 26.10% | -2.86 pp | 35.7 | 13.6 → 13.6 |

The down-ballot transform remains `clamp(50 + 5 × (House Democratic share − Harris share in percentage points), 0, 100)`. It fills the existing 20% down-ballot share inside local context. The other 429 scores reproduce v0.5 exactly.

## Boundaries

- The election data remains labeled `research_fallback`; Census authority supports only the historical county-name/code substitution.
- The raw MEDSL rows and obsolete identifier remain retained and inspectable.
- No winner, certified-canvass, boundary-equivalence, or split-county allocation claim is made.
- The normalization applies only to South Dakota 2024 U.S. House rows already labeled Oglala Lakota and carrying `46113`.

## Reproduction

```sh
npm run acquire:sd-county-fips-authority
npm run generate:sd-county-fips-normalization
npm run generate:house-score-v06-active
npx vitest run src/rapid-acquisition/south-dakota-county-fips-normalization.test.ts src/rapid-acquisition/house-score-v06-active.test.ts src/lib/house-priority-index.test.ts src/ui/rapid-expansion-status.test.ts
npm run typecheck
npm run lint
npm run data:verify
npm run build
```

Generated pins:

- normalization artifact: 2,949 bytes; SHA-256 `aaf06b4ee41499e4d78eab4154035f04a31f310544e541b8dab77fbb0f969543`; row set `1aeec7e72944de5bbcc7fc06ccaef1033919b6f0104252aba11c225e1ed8b989`; package `5a9d28b799b4c7993f6e1865b564e9a9de27ee01c3a167f9dadccf36737d7a00`.
- active score artifact: 456,292 bytes; SHA-256 `70a67d1bc6d6e85343868ce25afd5efb53148061cee82c9ca890a6479e0a7a02`; row set `d5415153a54c2827941605a61dc691bce43321df8cbfe62893bf06b167bb8f4f`; package `b20c1572d435126646ac3e41ab91477ad3a0372b10728854286d672bb98f0342`.
