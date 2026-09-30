# Priority Index v1.14 — 2026-09-30

## Outcome

House layer v0.11, Senate and governor layers v0.1 unchanged. State-legislative layer v0.1 adds Kentucky and Oregon, reaching thirty-six states.

## State-legislative layer v0.1, tenth batch

| State | Source | Contests | Seats scored (D / R) | Unscored |
|---|---|---|---|---|
| KY | State Board of Elections 2024 certification as amended (PDF, pinned text extract) | 119 | 118 (25 / 93) | 19 senators elected in 2022 (scanned certification), 1 write-in-only race |
| OR | Secretary of State abstracts of votes, 2024 and 2022 (PDF, pinned text extracts) | 150 | 90 (55 / 35) | 0 |

Both PDFs put candidates in columns, so `state-general/layout-columns.ts` splits layout rows into positioned cells and assigns text to the nearest column. Kentucky's party-heading row anchors each race; names printed one space apart are assigned word by word. Oregon's vote rows anchor the columns, county rows are summed and checked against each printed total, and the "Misc." column is write-ins. Kentucky's 2024 29th Senatorial District was contested only by write-in candidates and carries no party-labelled column; it is recorded without a margin.

Nebraska was examined and left out: its legislature is nonpartisan and the canvass carries no party labels, so no Democratic-minus-Republican margin exists.

A fifth party mismatch is flagged: Cyrus Javadi (OR House 32) won as a Republican in 2024 and is listed by Open States as a Democrat after switching in 2025.

Totals across thirty-six states: 6,520 contests, 5,146 seats scored (2,436 Democratic, 2,710 Republican). 1,301 state seats score at or above the top House score of 85.4; the ceiling decision from the v1.6 note is still open.

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
- `state-legislative-general-results-v1`: 6,607,244 bytes; SHA-256 `6f6b82c317108e764cd880607ca4bc289e4a3ca2f8e82e452b0976063076d848`; package `62e69683c3accf44205505e59716e21b7362dcd99078d7c02b4b5ce853517c90` (unchanged)
- `state-legislative-score-v01-projection-v1`: 12,854,111 bytes; SHA-256 `ab2c7c272328fe6723c024cf13581c7931e18b9f10c2a6d26b9cbffbf5645bc5`; package `096568e1328726ecdbde52b278428908532b753c405e5e89673e007a15d9ef2a` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.14 --date 2026-09-30
npm run data:verify
npm run test:fast
```
