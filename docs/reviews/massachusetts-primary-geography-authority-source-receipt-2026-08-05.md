# Massachusetts primary geography authority source receipt

Date: 2026-08-05
Status: acquisition-only official source evidence; no compatibility, approval, evaluator, score, publication, or deployment claim

## Retained authority

The repository now retains the official Census TIGER2022 Massachusetts 118th-congressional-district layer needed to assess the 2022 primary contests against the current CD119 target geography.

- Source-lock ID: `tiger-cd118-25`
- Official URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_25_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_25_cd118.zip`
- Byte size: `758,219`
- ZIP SHA-256: `ca6e9e2c25b06d4ee25fc8894f16c74226fd54a94dee2e70952e0f984a09629e`
- DBF member SHA-256: `14ae8af019661e6e57ab3ee962257c97b873aa4d64757709caa5ab6ae0c947ce`

The next candidate will also bind the already retained official CD119 layer:

- Source-lock ID: `tiger-cd119-25`
- Retained path: `data/source/tiger2025/tl_2025_25_cd119.zip`
- Byte size: `458,933`
- ZIP SHA-256: `d7d129c0b38114b3f555d84c1ae74cc7bc405562964e0a649e7b45d9c4325e9b`
- DBF member SHA-256: `7d174765fdc0b6b9ace930aea68ce24e02f8682b03a0edbbd64fd94c6d32d5ba`

The retained Census plan-change page states that Alabama, Georgia, Louisiana, New York, and North Carolina redrew congressional plans for the 119th Congress. Massachusetts is absent from that exact declaration. Retention alone does not prove raw geometry equality, district overlap, population equivalence, or an approved compatibility relationship.

## Reproduction

```bash
npm run fetch:ma-primary-geography-authority
npm run data:verify
```

The acquisition command validates the exact byte size, SHA-256, and ZIP signature before refusing conflicting output. `DSA_SEATS_MA_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE` may point to already downloaded bytes; the same validations still apply.
