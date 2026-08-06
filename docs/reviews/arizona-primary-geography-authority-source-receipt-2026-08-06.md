# Arizona primary geography authority source receipt

Date: 2026-08-06  
Status: authoritative source retained; no compatibility decision, evaluator value, publication, or deployment created

## Retained authority

The source lock now retains the official U.S. Census Bureau 2022 TIGER/Line Arizona 118th-congressional-district archive:

- Source-lock ID: `tiger-cd118-04`
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_04_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_04_cd118.zip`
- Byte size: `1,267,328`
- ZIP SHA-256: `26f7d5b1d693530d7562ca4aede3272fdf3ca9d127038f2be30fdbbb412aee58`
- Direct parents: none; this is a primary source

The archive contains exactly the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two ISO metadata documents, and `.shx` members for `tl_2022_04_cd118`.

## DBF closure evidence

The DBF member is inspected directly from the hash-locked ZIP and is not retained as a separate derived artifact:

- DBF byte size: `1,426`
- DBF SHA-256: `2998f4ac4396078c09e642070352741e7ba9a46c17bc29666d0a142c249e8a35`
- Record count: `9`
- `STATEFP20`: `04` on every row
- `CDSESSN`: `118` on every row
- `CD118FP`: exactly `01` through `09`
- `GEOID20`: exactly `0401` through `0409`
- Special or at-large rows: none

The already retained current source is `tiger-az` at `data/source/tiger2025/tl_2025_04_cd119.zip`, with SHA-256 `6eac2bd5c22110c21f0c22720f99317a72fe68cd943800ee266c970e54b2d674`. A separate compatibility candidate must bind both ZIPs, the retained Census plan-change authority, and the Arizona result and identity candidates before proposing historical-to-current relationships.

## Lifecycle boundary

This receipt records source acquisition only. It does not assert raw geometry equality, population equivalence, district continuity, candidate identity, winner selection, compatibility approval, evaluator eligibility, score eligibility, publication, or deployment. All such decisions remain separate and unresolved.

## Reproduction

```bash
npm run fetch:az-primary-geography-authority
npm run test:run -- scripts/fetch-arizona-primary-geography-authority.test.ts
npm run data:verify
```
