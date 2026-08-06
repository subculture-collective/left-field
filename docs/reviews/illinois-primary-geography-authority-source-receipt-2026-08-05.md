# Illinois primary geography authority source receipt — 2026-08-05

## Status

This receipt records acquisition and retention of the official Census 2022 Illinois 118th-Congress TIGER layer. It is factual source retention only. It creates no historical-geography relationship, approval, evaluator value, score, publication state, or deployment.

## Official source identity

- Publisher: United States Census Bureau
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_17_cd118.zip`
- Source-lock ID: `tiger-cd118-17`
- Retained path: `data/source/tiger2022/tl_2022_17_cd118.zip`
- Byte size: `2,592,115`
- ZIP SHA-256: `084e5944f06ce1b8a59a72586eea2f19a9ef284439c2ca915e110d43d351caf5`
- DBF member: `tl_2022_17_cd118.dbf`
- DBF byte size: `2,434`
- DBF SHA-256: `06d3456ca1522f919d56e4db8ce8c2b53317f1fb263f2475d64771e9e7e7265d`

The acquisition script binds body bytes rather than dynamic CDN headers, validates the exact length and SHA-256, requires a ZIP local-header signature and the exact seven-member central-directory inventory, and writes with exclusive-create semantics. An identical existing destination is accepted; conflicting bytes fail closed. Cached replay receives the same validation as the network response.

## Inventory boundary

The CD118 DBF has 18 records, all state FIPS `17` and session `118`: 17 numbered districts `01`–`17` with GEOIDs `1701`–`1717`, plus the `ZZ` / `17ZZ` `Congressional Districts not defined` sentinel. The retained CD119 DBF has the same 18-key shape at session `119`. A later candidate must validate and retain the sentinel in the source inventory but emit geography observations only for numbered districts.

The matching district/GEOID keys and Census plan-change authority can support a separately versioned compatibility proposal. They do not prove byte-identical geometry, coordinate equality, overlap thresholds, or population equivalence. CD118 and CD119 area fields differ slightly and must not be converted into a false equality claim.

## Reproduction

```bash
npm run fetch:il-primary-geography-authority
npm run test:run -- scripts/fetch-illinois-primary-geography-authority.test.ts
unzip -t data/source/tiger2022/tl_2022_17_cd118.zip
npm run data:verify
```
