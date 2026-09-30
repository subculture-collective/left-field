# Priority Index v1.10 — 2026-09-30

## Outcome

House layer v0.11, Senate and governor layers v0.1 unchanged. State-legislative layer v0.1 adds Alaska, Arkansas, Hawaii and Vermont, reaching twenty-eight states, and gains two data-quality checks.

## State-legislative layer v0.1, seventh batch

| State | Source | Contests | Seats scored (D / R) | Unscored with reason |
|---|---|---|---|---|
| AK | Division of Elections: 2024 results by precinct (CSV), 2022 summary report (XML, odd-lettered Senate districts) | 60 | 55 (23 / 32) | 3 independent holders, 2 contests with no major-party candidate |
| AR | Secretary of State 2024 precinct results workbook | 118 | 116 (22 / 94) | 17 senators elected in 2022 (no usable official file) |
| HI | Office of Elections 2024 summary | 43 | 43 (33 / 10) | 33 seats decided in the primary (not in the general file) |
| VT | Secretary of State election archive, GraphQL search, six retained pages | 125 | 176 (106 / 70) | 4 in contests with no major-party candidate |

Alaska has ranked-choice general elections; both files give first-choice totals, so an Alaska baseline is the first-round margin. Hawaii's general file lists only contested races; seats settled in the primary stay unscored and the 2022 file is not read, for the same reason as Florida. Vermont's contests are fetched page by page from the archive's GraphQL endpoint; each page is retained as its own source, and the retention script now supports JSON POST bodies. Vermont districts elect up to three members and candidates can run on several party lines.

## Data-quality checks added

- **No major party in the contest.** A contest with no Democratic or Republican candidate now has no margin instead of a margin of 0, which read as a toss-up. Seven seats move to the new status `no_major_party_in_contest`.
- **Party mismatch.** Each scored row records the party the holder ran under in the baseline contest. Four holders are listed by Open States in a different caucus from the line they won on: Marie Alvarado-Gil (CA Senate 4), Susan Valdés (FL House 64) and Lucas Atkinson (SC House 57), who switched parties after the election, and Elle Cochran (HI House 14), which is probably a roster error. These seats keep their scores; the brief states the discrepancy.

Totals across twenty-eight states: 5,167 contests, 4,002 seats scored (1,921 Democratic, 2,081 Republican). 989 state seats score at or above the top House score of 85.4; the ceiling decision from the v1.6 note is still open.

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
- `state-legislative-general-results-v1`: 5,254,071 bytes; SHA-256 `bc544e0a23d4135620418057e0696561532546c804f0267d3204c66705492c53`; package `fdff93b936ebe753ecbe77827ab739c2dc80c0155f42c8d58c4af1264720cce1` (unchanged)
- `state-legislative-score-v01-projection-v1`: 11,919,386 bytes; SHA-256 `91ccfe0d866dccf9540829ea699f74fb6138cd61cc7e2ca5674e51f9a2f8799d`; package `3a4d0acd20a6eda2e950d2f849d39979fdf9439c36541ebd6c9ac9aabbf72217` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.10 --date 2026-09-30
npm run data:verify
npm run test:fast
```
