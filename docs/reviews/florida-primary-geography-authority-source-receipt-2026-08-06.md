# Florida primary geography authority source receipt

Date: 2026-08-06  
Status: authoritative source retained; no compatibility decision, evaluator value, publication, or deployment created

## Retained authority

The source lock now retains the official U.S. Census Bureau 2022 TIGER/Line Florida 118th-congressional-district archive:

- Source-lock ID: `tiger-cd118-12`
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_12_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_12_cd118.zip`
- Byte size: `1,743,989`
- ZIP SHA-256: `1a1cd8468903aaf2d287a2f04c820e5a923b7d204d7e3fe5745bfb798ba1779b`
- Direct parents: none; this is a primary source

The archive contains exactly the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two ISO metadata documents, and `.shx` members for `tl_2022_12_cd118`.

## DBF closure evidence

The DBF member is inspected directly from the hash-locked ZIP and is not retained as a separate derived artifact:

- DBF byte size: `3,554`
- DBF SHA-256: `d0cbe7ff8e6b055accaee2812c9a857cc672a372588af4a5e6d26f0255cf156c`
- Record count: `28`
- `STATEFP20`: `12` on every row
- `CDSESSN`: `118` on every row
- `CD118FP`: exactly `01` through `28`
- `GEOID20`: exactly `1201` through `1228`
- Special or at-large rows: none

The already retained current source is `tiger-fl` at `data/source/tiger2025/tl_2025_12_cd119.zip`, with SHA-256 `037f8b6e99d178eed234675391dfea75ac245860c0b323faa75e79c47ba4813f`. Its embedded DBF is 3,950 bytes with SHA-256 `bbd120d03f2932801461728a3dca75f1e5bc3e7325a5c284719721c1fcb5dd3a`. A separate compatibility candidate must bind both ZIPs, the retained Census plan-change authority, and the Florida result and identity candidates before proposing historical-to-current relationships.

## Lifecycle boundary

This receipt records source acquisition only. It does not assert raw geometry equality, population equivalence, district continuity, candidate identity, winner selection, compatibility approval, evaluator eligibility, score eligibility, publication, or deployment. All such decisions remain separate and unresolved.

## Reproduction

```bash
npm run fetch:fl-primary-geography-authority
npm run test:run -- scripts/fetch-florida-primary-geography-authority.test.ts
npm run data:verify
```
