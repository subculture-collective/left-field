# Priority Index v1.11 — 2026-09-30

## Outcome

House layer v0.11, Senate and governor layers v0.1 unchanged. State-legislative layer v0.1 adds Massachusetts and Wyoming, reaching thirty states.

## State-legislative layer v0.1, eighth batch

| State | Source | Contests | Seats scored (D / R) | Unscored |
|---|---|---|---|---|
| MA | Secretary of the Commonwealth certified election statistics, 2024 House and Senate search pages (HTML as served) | 200 | 196 (166 / 30) | 1 independent |
| WY | Secretary of State official results summaries, 2024 (House, even Senate) and 2022 (odd Senate) | 93 | 93 (8 / 85) | 0 |

Massachusetts has no bulk export; its election search page lists every contest with a full candidate table, so the two pages are retained as served and parsed. The 6th Worcester special general on the House page is skipped. Senate district names are normalized from "&" and "1st" to the roster's "and" and "First". Wyoming's summaries workbook puts each district in a block of columns with a "Total" row; its 2024 "Statewide Senate Odd" sheet holds stale 2022 primary figures and is not read.

Louisiana was examined and deferred: its workbook uses namespaced spreadsheet XML that the shared reader does not parse, and it omits unopposed seats.

Totals across thirty states: 5,460 contests, 4,291 seats scored (2,095 Democratic, 2,196 Republican). The ceiling decision from the v1.6 note is still open.

## Immutable outputs

- `rapid-state-legislative-primary-context-v1`: 19,004 bytes; SHA-256 `e93024ea3dabbf5f07762dd85a0ae4688822882e39b8fade133c97870acf7e89`; package `0da8bd2a52533aa29995b477b4df70f485b810f6021c2ef796a7e4f6745d7658` (unchanged)
- `rapid-house-primary-2024-incumbent-evidence-v2`: 26,734 bytes; SHA-256 `4cd439117287831277f9aff40842c598c04ddd33c9cd1348dafe739e38aa76d2`; package `4b6407987d7cfbe1ec2d16c3a79edb96f1237bd75d1a02903532e923d99226b7` (unchanged)
- `house-score-v09-active-projection-v1`: 507,956 bytes; SHA-256 `cdbefeef90ef0d606ac6f892e4f14bb92e03975cd209d97745fa44eca6d73bd1`; package `b10ae4d65e815c1d207f9f87660082770db4783ea9a0e4515a8ee32df5e1a4b4` (unchanged)
- `statewide-presidential-2024-v1`: 17,342 bytes; SHA-256 `a5d4b06343a7f542d11e6529729945e8554e51e41228295cc7e94fb096674959`; package `e41c1361f9a93e481e14bba9b017cac282360c3b27aa8cd34a8d1746338bd24f` (unchanged)
- `senate-score-v01-projection-v1`: 208,922 bytes; SHA-256 `da12b66ad7586f8b93335382fbbfa72f2087dc992078fd26f487d0659f68e8ce`; package `ee06b046168eff55867bbb916b201dca58998808d2aba5ec851b7e26ecfe2c2d` (unchanged)
- `house-score-v10-active-projection-v1`: 373,592 bytes; SHA-256 `dc7d05776f71ca8c477b3f60e0be3945bcdf3d3e481378a6bc7f62d586cceca8`; package `2ef951affcd6d98b1ead93cf35d402d26bb0cdd44755440a31ace97bdc8cc402` (unchanged)
- `house-incumbent-candidacy-v1`: 181,474 bytes; SHA-256 `c0d4b60778aba1132ae5513c090243e236f32646859b7b0d6e90ed011ee60620`; package `bfde20b699e4a804a8cb1a522da45531f22cfb28e16df79857bfc26b93f40540` (unchanged)
- `house-score-v11-active-projection-v1`: 246,453 bytes; SHA-256 `b60f340316e371e4f288927e896145bc3e937c8c1e998e618df911a9977b85d4`; package `d4090aaeb4d8604de0e14479416b65268928ec61f40b914faf04b6dc49314834` (unchanged)
- `governor-score-v01-projection-v1`: 100,920 bytes; SHA-256 `9828838a28751867768cf3704b965eddff106297e6f73bc4278e62c9f9e67e4d`; package `13d86586c6fb0ace141597cad1abfa0d5fe966368b872110991161473575aabb` (unchanged)
- `state-legislative-roster-v1`: 6,093,010 bytes; SHA-256 `00be4090582f8b5b9e2a6cde80a767ded8b3a806bd6b469da1fff36c88d2264b`; package `aebf57452e4e6ad9eb0bc69b8886db2951e21f0cae5d50ad84cfd916d3477199` (unchanged)
- `state-legislative-general-results-v1`: 5,565,735 bytes; SHA-256 `6cf8985edc450255ef53f034bc488d890e50947f0a35de88cf26650d44153139`; package `0d206449233926e8b1b3fecf19218fbdc772864826f4c53de490c08d2e1cf7c5` (unchanged)
- `state-legislative-score-v01-projection-v1`: 12,155,065 bytes; SHA-256 `267b90e79dae1028bd678a5ab3f2570b88e4081913278a07e63bf8a75c2946b4`; package `6169e066272d3428ac924fc56ed9aa02db692c7323a3a8bf0c795cb8e13b3f26` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.11 --date 2026-09-30
npm run data:verify
npm run test:fast
```
