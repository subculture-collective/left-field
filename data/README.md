# Pinned prototype geography

The archives under `source/tiger2025/` are official 2025 Census TIGER/Line
CD119 and state shapefiles. Their checksums are pinned in `SHA256SUMS`.
The Census describes these as legal boundaries and names as of January 1,
2025; they are mapping data, not legal land descriptions.

The selected EPSG:4326 GeoJSON artifacts under `geometry/` contain only the
ten prototype House districts and their four states. They were produced with
`mapshaper@0.6.113`, using `CD119FP`/`STATEFP` filters and precision
`0.0000001`. To deterministically rebuild all five retained artifacts:

```bash
bash scripts/build-tiger-artifacts.sh
```

The normalizer removes incidental shapefile attributes, orders features by
source GEOID, and promotes Polygon values to MultiPolygon so the same geometry
contract feeds both in-memory and PostGIS adapters.

The build reads only retained ZIPs, writes to a temporary directory, and
replaces the five GeoJSON outputs only after validation succeeds. It invokes
the exact local project dependency `mapshaper@0.6.113` from `node_modules`;
it does not use `npm exec` or network package resolution. Source ZIPs are
never overwritten. Verify with `npm run data:verify` and the canonical geometry
tests.

Source: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html

U.S. Census Bureau material is a U.S. Government work and may be reproduced;
retain Census attribution and the source's non-warranty notice.

## Privacy and source lock

`source-lock.json` pins every retained artifact and records nonretained FEC
response metadata. Run `npm run data:verify` before changing source data.
FEC CSV bodies are never retained: they may disclose contributor information and
are subject to 52 U.S.C. §30111(a)(4), notwithstanding government publication.
`source/fec/summary-filings.json` contains filing metadata and response hashes
only. Finance values in this private prototype are intentionally uncollected;
see `metadata/phase0-collection-status.json`.
