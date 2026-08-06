# Maryland primary geography authority source receipt

Date: 2026-08-06
Status: authoritative source retained; no compatibility decision, evaluator value, publication, or deployment created

## Retained authority

The source lock now retains the official U.S. Census Bureau 2022 TIGER/Line Maryland 118th-congressional-district archive:

- Source-lock ID: `tiger-cd118-24`
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_24_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_24_cd118.zip`
- Byte size: `1,180,466`
- ZIP SHA-256: `142317ecc6eff27a9cc490663886b4d48ca2c6f4494aa68fb6d991ece8f88016`
- Direct parents: none; this is a primary source

The archive contains exactly the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two ISO metadata documents, and `.shx` members for `tl_2022_24_cd118`.

## DBF closure evidence

The DBF member is inspected directly from the hash-locked ZIP and is not retained as a separate derived artifact:

- DBF byte size: `1,314`
- DBF SHA-256: `2d3bff5178049477f2de933adb0d6081207c7e29c077f702007f8714072fa11a`
- Record count: `8`
- `STATEFP20`: `24` on every row
- `CDSESSN`: `118` on every row
- `CD118FP`: exactly `01` through `08`
- `GEOID20`: exactly `2401` through `2408`
- Special or at-large rows: none

The already retained current source is `tiger-cd119-24` at `data/source/tiger2025/tl_2025_24_cd119.zip`, with SHA-256 `f6cdfd5687a8b2edb86382177bea8901b731cbe6c4ded11d77aec7b67adce103`. Its embedded DBF is 1,450 bytes and contains exactly the eight Maryland CD119 keys. A separate compatibility candidate must bind both ZIPs, the retained Census plan-change authority, and the Maryland result and identity candidates before proposing historical-to-current relationships.

## Lifecycle boundary

This receipt records source acquisition only. It does not assert raw geometry equality, population equivalence, district continuity, candidate identity, winner selection, compatibility approval, evaluator eligibility, score eligibility, publication, or deployment. All such decisions remain separate and unresolved.

## Reproduction

```bash
npm run fetch:md-primary-geography-authority
npx vitest run scripts/fetch-maryland-primary-geography-authority.test.ts
npm run data:verify
```
