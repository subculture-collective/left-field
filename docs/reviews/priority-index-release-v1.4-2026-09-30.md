# Priority Index v1.4 — 2026-09-30

## Outcome

House layer v0.11 (source cutoff 2026-08-04); Senate layer v0.1 and governor layer v0.1 (FEC and roster snapshot 2026-09-24, `fec-candidate-summary-2026-20260924`). New in this release: a state-legislative layer, v0.1, covering California, Georgia, New York and Virginia.

## State-legislative layer v0.1

State-legislative seats are ranked from the seat's own most recent general-election margin, read from each state's official returns, instead of a presidential overlay that does not exist as an open file (issue #36). The chamber-agnostic scorer is unchanged; the own-race margin takes the place of the presidential margin in the blue baseline and the competitiveness score.

| State | Source | Contests | Cycles | Uncontested | Seats scored (D / R) |
|---|---|---|---|---|---|
| CA | Secretary of State, Statement of Vote candidate export, 2024 and 2022 (even Senate districts) | 200 (160 Assembly, 40 Senate) | 2022, 2024 | 3 | 118 (89 / 29) |
| GA | Secretary of State, certified 2024 general "Total Votes" workbook | 236 (180 House, 56 Senate) | 2024 | 123 | 235 (103 / 132) |
| NY | State Board of Elections, Elections Database export, 2024 general (election id 161) | 213 (150 Assembly, 63 Senate) | 2024 | 77 | 212 (143 / 69) |
| VA | Department of Elections, official ENR ballot items, 2023 (both chambers) and 2025 (House) | 240 (200 House, 40 Senate) | 2023, 2025 | 52 | 139 (84 / 55) |

Result: 704 seats scored (419 Democratic, 285 Republican); 83 Democratic seats also carry retained primary feasibility; 220 baselines are races with no more named candidates than seats. The other 6,640 roster seats are carried unscored as `state_not_covered`. Term lengths are chamber defaults, so the next-election year is the baseline cycle plus the term (California Senate seats elected in 2022 are next up in 2026, those elected in 2024 in 2028).

Reading rules worth knowing: California's top-two general can pair two Democrats, which is recorded as contested with a Democratic margin of 100. New York fusion lines are summed per candidate; the three candidates who ran on both major lines are attributed to whichever line drew more votes (Kalman Yeger and Jaime R. Williams to the Democratic line, Simcha Felder to the Republican line). "Scattering" write-ins count in the total; "Blank", "Void" and "Total Votes" rows are dropped.

Known property: an uncontested Democratic seat with no primary evidence scores 86.0, the blue-only ceiling under the coverage multiplier, which places 204 state seats at or above the top House score (85.4). That follows from the shared model and is disclosed on the methodology page. Two refinements are open for v0.2: count missing primary feasibility against available weight, or treat an uncontested race as a weaker observation than a contested margin.

Retention: `npm run rapid:state-returns` downloads and pins the adapter-declared files; both artifacts are registered in `scripts/rapid/derived-artifacts.ts` and re-derived by publish. Minnesota's returns portal blocks this host's egress (Radware challenge); Pennsylvania publishes precinct-level files only (64 MB for both cycles) and is deferred.

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
- `state-legislative-general-results-v1`: 905,774 bytes; SHA-256 `9bf2bb3112bb0aae83a4b839eef74db53bd10def30f5826f6ad102e4187626a9`; package `9360819e6b3fe9cf45d67d79f8dc448c6ce9a8955bde24039047b304e0bb8867` (unchanged)
- `state-legislative-score-v01-projection-v1`: 8,749,728 bytes; SHA-256 `200d030159552670168339f0ed6c98e8684eee079219df132018d3d6ff35c83c`; package `b13175f64dd5a36c29b29027ef5c5d3592007bab821c444a5a02e0f82583061c` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.4 --date 2026-09-30
npm run data:verify
npm run test:fast
```
