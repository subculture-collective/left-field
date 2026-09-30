# Priority Index v1.7 — 2026-09-30

## Outcome

House layer v0.11, Senate and governor layers v0.1 unchanged. State-legislative layer v0.1 adds Florida and Maine, reaching fourteen states.

## State-legislative layer v0.1, fourth batch

| State | Source | Contests | Seats scored (D / R) | Unscored with reason |
|---|---|---|---|---|
| FL | Division of Elections official results extract, 2024 and 2022 (form POST) | 136 | 130 (28 / 102) | 24 unopposed, 1 independent holder |
| ME | Secretary of State 2024 tabulation workbooks | 186 | 182 (95 / 87) | 2 tribal representatives, 4 independent holders |

Florida does not put unopposed races on the ballot, so the extract has no row for them. Those 24 seats (15 House, 9 Senate) stay `no_contest_for_district` rather than receiving an inferred margin, and the 2022 file is read only for even-numbered Senate districts so an older contest never stands in for a newer unopposed one. The retention script now supports publishers that serve a file only in response to a form POST; the lock URL records the form body.

Maine's workbooks stack every district on one sheet in two header layouts (names above the DIST row or on it). The adapter detects the layout per block, re-sums the municipality rows, and fails if the cached formula total disagrees. The two tribal representatives in the roster have no district contest and stay unscored.

Totals across fourteen states: 3,004 contests, 2,368 seats scored (1,331 Democratic, 1,037 Republican). 709 state seats now score at or above the top House score of 85.4. The ceiling problem described in the v1.6 note grows with coverage and still needs a decision.

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
- `state-legislative-general-results-v1`: 3,066,137 bytes; SHA-256 `b89f2df6558b4040e0ef370d57eb7dbfbcbf1a689ca88653a35ea6e577baa041`; package `5c08b6c2840f070c723e8620de5f9c29a0711e351bb849636f92e163936ad98d` (unchanged)
- `state-legislative-score-v01-projection-v1`: 10,092,132 bytes; SHA-256 `03f16f266d3f5a6ead5a899bff432516ae47436dcb6706b4f4ac436a1bc41dfe`; package `5fd8c3f6f50b80cb75758bbf69f323d923fce925b486de48ae946759ecd2f364` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.7 --date 2026-09-30
npm run data:verify
npm run test:fast
```
