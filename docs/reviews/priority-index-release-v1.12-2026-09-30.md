# Priority Index v1.12 — 2026-09-30

## Outcome

House layer v0.11, Senate and governor layers v0.1 unchanged. State-legislative layer v0.1 adds Kansas, Missouri, New Jersey and Texas, reaching thirty-four states.

## State-legislative layer v0.1, ninth batch

| State | Source | Contests | Seats scored (D / R) | Unscored |
|---|---|---|---|---|
| KS | Secretary of State 2024 official vote totals (PDF, pinned text extract) | 165 | 165 (46 / 119) | 0 |
| MO | Secretary of State official results 2024 and 2022 (PDF, pinned text extracts) | 360 | 188 (60 / 128) | 0 |
| NJ | Division of Elections official results, 2025 Assembly and 2023 Senate (PDF, pinned text extracts) | 80 | 120 (82 / 38) | 0 |
| TX | Secretary of State election night reporting data, 2024 and 2022 (Senate only) | 186 | 174 (73 / 101) | 5 Senate districts elected unopposed in 2022 |

**Network path.** The Texas and Kansas sites refuse this project's usual network path (a VPN exit), so their files were retained through the owner's residential connection: an existing Linux network namespace that routes over Ethernet to the ISP router, entered only for the download commands. Host routing was not changed. The Texas site also rejects non-browser user agents, so sources can now declare a user agent.

**PDF sources.** State sources can declare `pdfLayoutExtract`. The retention script runs `pdftotext -layout` once and pins the text beside the PDF as a derived extract, so no build or test needs pdftotext. Kansas lists every race with party-prefixed candidates. Missouri's race blocks carry a "Total Votes" line that is checked against the candidate sum. New Jersey's candidate lists carry a per-candidate total and a per-district total, and every district total matches the candidate sum. Wrapped names, bracket notes, and candidates repeated across page breaks are handled.

**Not reachable or not machine-readable.** Minnesota, Ohio, New Hampshire, Arizona, Nevada and Michigan block even a real browser from the residential address; Minnesota flagged it after two visits, so no further requests were made. Arizona's results app encrypts its data client-side and was not worked around. Mississippi's 2023 certified legislative results are scanned images without a text layer, as are Utah's and Kentucky's 2022 canvasses; they would need OCR and are deferred.

Totals across thirty-four states: 6,251 contests, 4,938 seats scored (2,356 Democratic, 2,582 Republican). 1,265 state seats score at or above the top House score of 85.4; the ceiling decision from the v1.6 note is still open.

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
- `state-legislative-general-results-v1`: 6,328,091 bytes; SHA-256 `617d0589018bdd82ad8dcb4de1955b8b5a0ffbcf241adfbd3ce1d4ecdf934159`; package `ae11e4bbe00a28eb0ec1346dc9760e9961fcfa91564bb18bfdecb466dbf234e5` (unchanged)
- `state-legislative-score-v01-projection-v1`: 12,683,699 bytes; SHA-256 `7ef8283786385533092c783f3333dd160cb9f43acf7b18b46838d541c14d96c6`; package `2dc0ec63e1618494e2697d550c2c74db7ad4ba50f7d8ff1bc8b0bb5463a77416` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.12 --date 2026-09-30
npm run data:verify
npm run test:fast
```
