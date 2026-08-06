# New York primary geography authority source receipt

Date: 2026-08-06  
Status: authoritative source retained; no compatibility decision, evaluator value, publication, or deployment created

## Retained authority

The source lock now retains the official U.S. Census Bureau 2022 TIGER/Line New York 118th-congressional-district archive:

- Source-lock ID: `tiger-cd118-36`
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_36_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_36_cd118.zip`
- Byte size: `1,271,850`
- ZIP SHA-256: `038a6cc7a89bd9833d9698993683628c82598a085e87093bbd978af7454dd7fa`
- Direct parents: none; this is a primary source

The archive contains exactly the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two ISO metadata documents, and `.shx` members for `tl_2022_36_cd118`.

## DBF closure evidence

The DBF member is inspected directly from the hash-locked ZIP and is not retained as a separate derived artifact:

- DBF byte size: `3,330`
- DBF SHA-256: `f53ed96ec308887bf14b6b829deefbae6ecaa23027da40a6ae3bb6fdabbaf91f`
- Record count: `26`
- `STATEFP20`: `36` on every row
- `CDSESSN`: `118` on every row
- `CD118FP`: exactly `01` through `26`
- `GEOID20`: exactly `3601` through `3626`
- Special or at-large rows: none

The already retained current source is `tiger-cd119-36` at `data/source/tiger2025/tl_2025_36_cd119.zip`, with SHA-256 `0955e0f7060dd43af98d939cbabb10df578901184472cbba57c91518c52991c7`.

## Redraw and lifecycle boundary

The retained Census plan-change authority identifies New York as a state that redrew congressional districts for the 119th Congress. Matching district numbers between CD118 and CD119 therefore do not establish plan continuity. This acquisition creates no 2022-to-current compatibility relationship and does not use raw geometry, district-number equality, or candidate identity as a substitute for an authoritative or explicitly reviewed crosswalk. The 2024 observations can be assessed separately against the exact CD119 session and district inventory.

This receipt records source acquisition only. It does not assert raw geometry equality, population equivalence, district overlap, candidate identity, winner selection, compatibility approval, evaluator eligibility, score eligibility, publication, or deployment. All such decisions remain separate and unresolved.

## Reproduction

```bash
npm run fetch:ny-primary-geography-authority
npx vitest run scripts/fetch-new-york-primary-geography-authority.test.ts
npm run data:verify
```
