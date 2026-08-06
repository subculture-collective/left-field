# Washington primary geography authority — 2026-08-06

## Outcome

The repository retains the official Census TIGER/Line CD118 Washington congressional-district archive. This closes the missing historical-session district inventory needed to evaluate 2022 Washington contest geography against the already retained CD119 target-session archive.

The source contains all ten Washington districts, numbered `01` through `10`. Every DBF row identifies state FIPS `53`, Congress session `118`, and the exact `53xx` GEOID formed from its district key. This is an authority input only: retaining it does not approve a geography relationship, publish election data, or make Washington's top-two results compatible with the partisan-primary formula.

## Integrity

- Official URL: `https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_53_cd118.zip`
- Retained path: `data/source/tiger2022/tl_2022_53_cd118.zip`
- Byte size: 1,128,169
- ZIP SHA-256: `8994727a7d0462a72553d09f7f2ca91d75f77f24a01435d786003b4bb499b762`
- DBF byte size: 1,538
- DBF SHA-256: `2f996229056db97ad7f7715ef666b404903d17a8b298cfaabf3aeaafaeb2c13f`
- Archive members: the expected `.cpg`, `.dbf`, `.prj`, `.shp`, two XML metadata files, and `.shx`

## Reproduction

```bash
npm run fetch:wa-primary-geography-authority
npx vitest run scripts/fetch-washington-primary-geography-authority.test.ts
npm run data:verify
```

The fetcher pins exact bytes and archive membership, supports an explicit cache file for deterministic replay, writes create-only, and rejects source drift or an output conflict. The next reviewer-candidate step must compose this CD118 inventory, the retained CD119 archive, Census plan-change authority, the Washington identity candidate, and the certified top-two receipt without weakening the formula-incompatibility fence.
