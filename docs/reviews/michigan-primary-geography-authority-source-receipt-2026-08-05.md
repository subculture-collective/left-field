# Michigan primary geography authority source receipt

Date: 2026-08-05
Status: authoritative source retained; no compatibility decision, evaluator value, publication, or deployment created

## Retained authority

The source lock now retains the official U.S. Census Bureau 2022 TIGER/Line Michigan 118th-congressional-district archive:

- Source-lock ID: `tiger-cd118-26`
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_26_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_26_cd118.zip`
- Byte size: `697,427`
- ZIP SHA-256: `b9bd038619c00e3142f9ac14dd4c2bda8715c224f39b47c8086f18c3400842fd`
- Direct parents: none; this is a primary source

The archive contains exactly the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two ISO metadata documents, and `.shx` members for `tl_2022_26_cd118`.

## DBF closure evidence

The DBF member is inspected directly from the hash-locked ZIP and is not retained as a separate derived artifact:

- DBF byte size: `1,874`
- DBF SHA-256: `577a26e1d57e171e105ab3efc241d4a72a3b39df3f7519e5e78c00528caf8544`
- Record count: `13`
- `STATEFP20`: `26` on every row
- `CDSESSN`: `118` on every row
- `CD118FP`: exactly `01` through `13`
- `GEOID20`: exactly `2601` through `2613`
- Special or at-large rows: none

The already retained current source is `tiger-cd119-26` at `data/source/tiger2025/tl_2025_26_cd119.zip`, with SHA-256 `2d5e68577dcc7638acfcad8727705a3e97ebca92f59cd16876b2e0efc8183066`. A separate compatibility candidate must bind both ZIPs, the retained Census plan-change authority, and the Michigan results and identity candidates before proposing historical-to-current relationships.

## Lifecycle boundary

This receipt records source acquisition only. It does not assert raw geometry equality, population equivalence, district continuity, candidate identity, winner selection, compatibility approval, evaluator eligibility, score eligibility, publication, or deployment. All such decisions remain separate and unresolved.

## Reproduction

```bash
npm run fetch:mi-primary-geography-authority
npm run test:run -- scripts/fetch-michigan-primary-geography-authority.test.ts
npm run data:verify
```
