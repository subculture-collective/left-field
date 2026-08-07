# Minnesota primary geography authority source receipt

Date: 2026-08-06
Status: source retention only; no compatibility approval, evaluator value, score, publication, or deployment

The official Census 118th Congress Minnesota TIGER/Line archive is retained as `tiger-cd118-27` at `data/source/tiger2022/tl_2022_27_cd118.zip`. It is 1,417,044 bytes with SHA-256 `4d466968af5759e647552ff99943773dbcde5b6317d4f2d2affa8ed12e09a652`. Its seven-member ZIP contains a 1,314-byte DBF with SHA-256 `e1ca8fffc724a9fab808971f1ccff1c23df71d574608e14d87c7470e0166a13e`.

The DBF closes exactly eight active Minnesota rows: state FIPS 27, session 118, numbered district codes 01 through 08, and GEOIDs 2701 through 2708. It contains no special district row. The fetcher is create-only, supports an explicit cache file, validates the exact byte hash and seven-member archive inventory, and rejects remote drift or an output conflict.

The already retained current source is `tiger-cd119-27`, `data/source/tiger2025/tl_2025_27_cd119.zip`, 862,757 bytes, SHA-256 `4b7a969ad818b03cda1dc8294b6d945280d6e5ac4771aed03d8548aa1dae69f7`. Its DBF likewise closes eight numbered Minnesota keys for session 119.

The retained Census plan-change page identifies Alabama, Georgia, Louisiana, New York, and North Carolina as the states that redrew for the 119th Congress. Minnesota is not in that list. This supports a proposed CD118-to-CD119 plan-continuity relationship; it does not establish raw shapefile equality, overlap percentages, population equivalence, or reviewer approval.

```bash
npm run fetch:mn-primary-geography-authority
npm run data:verify
```
