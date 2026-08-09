# Rapid Indiana House-primary results v2 — 2026-08-09

Indiana's current official election-night reporting site now exposes complete 2026 primary data. The retained settings identify the May 5, 2026 primary, mark it certified, and bind version `20260601_080354`. The retained House JSON enumerates all nine congressional districts.

For the two target districts, the Democratic observations are:

- IN-01: Frank J. Mrvan 42,519; LaVetta Sparks-Wade 10,467; 52,986 total. The source marks Mrvan as winner.
- IN-07: André Carson 44,849; Destiny Wells 16,852; George Hornedo 7,517; Denise Paul Hatch 2,646; 71,864 total. The source marks Carson as winner.

The source winner marker is retained as a result fact only. Candidate identity, winner identity, scoring, and publication approval remain unset. The settings certify the current ENR dataset, but no separate signed certificate bytes are retained.

## Exact artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| 2026 settings | 3,249 | `a5fc6ec16d7ff91492ebc8b1d2d58959ee38f21bf0daeec87abb67d006122601` |
| 2026 U.S. House results | 192,012 | `422cb0a21cd53eaf24177c97f8c4b4b8f6a30e2420264a2db4d1785ed610b65d` |
| Indiana v2 result package | 6,135 | `26a2b6018634abde4d0590e0bea3583300cc00134164ec77d653dc5c6bc8fb30` |
| Nationwide primary projection v20 | 63,829 | `5b63bc5e03138aa73432c2c32c4cd306dff0c2bc91dc254fc0aa9718173c90b8` |
| Coverage ledger v20 | 20,309 | `fc585168dc2519eadb8b024b5eff38c4a272ce0588517b980cf2bbecc73b3381` |

Projection v20 contains 38 reported contests and four source-absence observations across 78 target district-cycle observations. All 42 processed observations remain excluded from the active Priority Index.

## Reproduction

```bash
npm run acquire:rapid-house-primary-indiana-2026
npm run generate:rapid-house-primary-indiana-results-v2
npm run generate:rapid-house-primary-projection-v20
npx vitest run src/rapid-acquisition/house-primary-indiana-results-v2.test.ts src/rapid-acquisition/house-primary-projection-v20.test.ts src/ui/rapid-house-primary-coverage.test.ts
npm run typecheck
npm run data:verify
```
