# Priority Index v1.8 — 2026-09-30

## Outcome

House layer v0.11, Senate and governor layers v0.1 unchanged. State-legislative layer v0.1 adds six states, reaching twenty.

## State-legislative layer v0.1, fifth batch

| State | Source | Contests | Cycles | Uncontested | Seats scored (D / R) | Unscored |
|---|---|---|---|---|---|---|
| DE | Department of Elections results on the state open data portal, 2024 and 2022 | 113 | 2022, 2024 | 52 | 62 (42 / 20) | 0 |
| IN | Election Division ENR archive, AllOfficeResults.csv, 2024 and 2022 | 250 | 2022, 2024 | 100 | 149 (40 / 109) | 1 independent |
| RI | Board of Elections results JSON, 2024 | 113 | 2024 | 70 | 111 (97 / 14) | 1 independent |
| SC | Election Commission Clarity summary, 2024 | 170 | 2024 | 90 | 170 (47 / 123) | 0 |
| TN | Secretary of State "All by Precinct" workbooks, 2024 and 2022 | 231 | 2022, 2024 | 95 | 131 (29 / 102) | 0 |
| WV | Secretary of State Clarity summaries, 2024 and 2022 | 234 | 2022, 2024 | 74 | 134 (11 / 123) | 0 |

Reading rules: Clarity summaries now go through a shared reader (`state-general/clarity.ts`); Colorado keeps its own parser. South Carolina and Rhode Island prefix candidate names with the party code, which is removed. West Virginia Senate districts elect two members in different years, recorded as positions named for the cycle; each holder is matched to the contest naming them. Tennessee column positions differ between years and are located by header. Indiana counties report at precinct or locality level, never both, so rows sum without double counting.

Totals across twenty states: 4,115 contests, 3,125 seats scored (1,597 Democratic, 1,528 Republican). 843 state seats now score at or above the top House score of 85.4. The ceiling decision from the v1.6 note is still open.

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
- `state-legislative-general-results-v1`: 4,148,292 bytes; SHA-256 `6319ac7edace259c5912e6910902e7bca4e37aa64662f0274d9108542396b1cd`; package `a2af5c1eed673adc8b7c35bb915234e818728f1085cdeafe449ed76cd8302aa9` (unchanged)
- `state-legislative-score-v01-projection-v1`: 10,710,702 bytes; SHA-256 `5565d6d53db760d14da3944b452ed0e520a87181c1eacd37bc1afda7f97398c8`; package `4b0f33128a1b87b9154a331cc387d1e02f11408df1f88d43bee8f0dae05ff940` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.8 --date 2026-09-30
npm run data:verify
npm run test:fast
```
