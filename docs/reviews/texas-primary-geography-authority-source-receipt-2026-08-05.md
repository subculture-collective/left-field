# Texas primary geography authority source receipt — 2026-08-05

## Status

This receipt records acquisition and retention of the official Census 2022 Texas 118th-Congress TIGER layer. It is factual source retention only. It creates no historical-geography relationship, compatibility candidate, approval, evaluator value, score, publication state, or deployment.

## Official source identity

- Publisher: United States Census Bureau
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_48_cd118.zip`
- Source-lock ID: `tiger-cd118-48`
- Retained path: `data/source/tiger2022/tl_2022_48_cd118.zip`
- Byte size: `6,498,062`
- ZIP SHA-256: `eb07bd3e91c902b3289db239a3fee0bc1e248bfa672a0a1d347572ee79c1fa68`
- DBF member: `tl_2022_48_cd118.dbf`
- DBF byte size: `4,674`
- DBF SHA-256: `d72e8c1bebc681f31ceeac111678ea8dae432b346200a2e46004e0c2e4dc6c8d`

The acquisition script binds body bytes rather than dynamic CDN headers, validates the exact length and SHA-256, requires a ZIP local-header signature and the exact seven-member central-directory inventory, and writes with exclusive-create semantics. An identical existing destination is accepted; conflicting bytes fail closed. Cached replay receives the same validation as the network response.

## Inventory boundary

The CD118 DBF has exactly 38 records, all state FIPS `48` and session `118`: districts `01`–`38` with GEOIDs `4801`–`4838`. The retained CD119 DBF has the same 38 numbered district/GEOID keys at session `119`. Neither Texas layer contains an at-large or `ZZ` sentinel.

The matching keys and separately retained Census plan-change authority can support a separately versioned compatibility proposal. Source retention alone does not prove a relationship. It also does not prove byte-identical geometry, coordinate equality, an overlap threshold, or population equivalence; a later candidate must preserve those boundaries explicitly.

## Reproduction

```bash
npm run fetch:tx-primary-geography-authority
npm run test:run -- scripts/fetch-texas-primary-geography-authority.test.ts
unzip -t data/source/tiger2022/tl_2022_48_cd118.zip
npm run data:verify
```
