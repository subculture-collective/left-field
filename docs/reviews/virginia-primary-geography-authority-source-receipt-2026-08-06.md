# Virginia primary geography authority source receipt

Date: 2026-08-06
Status: authoritative source retained; no compatibility decision, evaluator value, publication, or deployment created

## Retained authority

The source lock retains the official U.S. Census Bureau 2022 TIGER/Line Virginia 118th-congressional-district archive:

- Source-lock ID: `tiger-cd118-51`
- URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_51_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_51_cd118.zip`
- Byte size: `2,912,195`
- ZIP SHA-256: `b5aa7d080a41ab64350340844c2658bf16fe3549b89fb9b65262af4821ba6001`
- Direct parents: none; this is a primary source

The archive contains exactly the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two ISO metadata documents, and `.shx` members for `tl_2022_51_cd118`.

## DBF closure evidence

The DBF member is inspected directly from the hash-locked ZIP and is not retained separately:

- DBF byte size: `1,650`
- DBF SHA-256: `78cf73e65ebf2207d06662bfa446e22667df0ea1a0ff580c94de5edd1ab916b3`
- Record count: `11`
- `STATEFP20`: `51` on every row
- `CDSESSN`: `118` on every row
- `CD118FP`: exactly `01` through `11`
- `GEOID20`: exactly `5101` through `5111`
- Special or at-large rows: none

The already retained current authority is `tiger-cd119-51` with ZIP SHA-256 `e9c7eabefcf65e957fb4d505c759dfed08e1a994dbeff34ba015d4a9b612d731`. Its embedded DBF is 1,825 bytes with SHA-256 `cb2c35b7d550b7fda62c1d35f333fa0e0ed558da05edafc8535f9824942cfbe3`. A separate compatibility candidate must bind both ZIPs, the Census plan-change authority, and the Virginia result and identity candidates before proposing any historical-to-current relationship.

## Lifecycle boundary

This receipt records source acquisition only. It does not assert raw geometry equality, population equivalence, district continuity, candidate identity, winner selection, compatibility approval, evaluator eligibility, score eligibility, publication, or deployment.

## Reproduction

```bash
npm run fetch:va-primary-geography-authority
npm run test:run -- scripts/fetch-virginia-primary-geography-authority.test.ts
npm run data:verify
```
