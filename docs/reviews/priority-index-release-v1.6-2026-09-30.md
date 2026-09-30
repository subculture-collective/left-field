# Priority Index v1.6 — 2026-09-30

## Outcome

House layer v0.11 (source cutoff 2026-08-04); Senate layer v0.1 and governor layer v0.1 (FEC and roster snapshot 2026-09-24). State-legislative layer v0.1 grows from six to twelve states: Colorado, Connecticut, Maryland, North Carolina, Pennsylvania and Washington are new.

## State-legislative layer v0.1, third batch

| State | Source | Contests | Cycles | Uncontested | Seats scored (D / R) |
|---|---|---|---|---|---|
| CO | Secretary of State, county-certified Clarity ENR summary, 2024 and 2022 | 165 | 2022, 2024 | 16 | 100 (66 / 34) |
| CT | Secretary of the State, Election History export, 2024, town level | 187 | 2024 | 45 | 187 (127 / 60) |
| MD | State Board of Elections, 2022 legislative breakdown | 118 (141 delegate seats) | 2022 | 44 | 188 (136 / 52) |
| NC | State Board of Elections, 2024 precinct results | 170 | 2024 | 30 | 168 (67 / 101) |
| PA | Department of State, precinct bulk returns, 2024 and 2022 | 456 | 2022, 2024 | 180 | 253 (126 / 127) |
| WA | Secretary of State, legislative results export, 2024 and 2022 | 246 | 2022, 2024 | 47 | 147 (89 / 58) |

Earlier states are unchanged: CA 118, GA 235, IL 177, NY 212, VA 139, WI 132 seats scored.

Totals across twelve states: 2,682 contests; 2,056 seats scored (1,208 Democratic, 848 Republican); 105 with retained primary feasibility; 623 baselines from races with no more named candidates than seats. Two North Carolina holders are recorded by Open States as Independent and stay `holder_party_not_scored`. 5,286 roster seats remain `state_not_covered`.

Reading rules:

- Washington elects two House positions per district as separate contests. Contests now carry an optional `position`; the score layer gives each holder the position contest that names them, and an appointee named in neither takes the position no colleague matched. Every Washington district ends with two distinct positions.
- Maryland House districts elect one to three delegates; the seat count is the number of named winners the Board marks, and the margin uses party totals across all candidates. Votes are read from the per-district columns, and a vote outside the candidate's own district fails the build.
- Connecticut rows repeat at town and polling-place level; only town rows are read, because polling-place rows omit centrally counted ballots. In House districts 48 and 101 the published "Total Votes Cast" differs from the candidate sum by 31 and 1 votes; the margin uses the candidate sum. Fusion lines are summed per candidate, as in New York.
- Pennsylvania lists one cross-filed ("D/R") candidate, Joseph McAndrew in House District 32. Cross-filed candidates are resolved through an explicit table keyed by candidate number, and any unlisted one fails the build.

## The ceiling problem is now the main limitation

658 state seats score at or above the top House score of 85.4, almost all at exactly 86.0: an uncontested Democratic seat with no primary evidence reaches the blue-only ceiling under the coverage multiplier. The opening field of the index is therefore dominated by safe state seats whose only signal is "nobody ran against the incumbent". That is a real signal for a left primary challenge, but a tie of several hundred seats does not rank anything. A v0.2 decision is needed before more states are added; options are listed in the v1.4 note.

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
- `state-legislative-general-results-v1`: 2,743,818 bytes; SHA-256 `e932d17a0b10a644207f2199f578b3b16b31fb67ffef9fb937637a4f9c177785`; package `4b50e6e510d99e44adf5f031134237adf20b1668437f4b8a44ce91ed26b956c3` (unchanged)
- `state-legislative-score-v01-projection-v1`: 9,837,417 bytes; SHA-256 `6dbd0831f0c6e865122837f7f865774ca371d6ed8b8cb8a68d3b2bab3648b403`; package `ad00e2c22e38568a1a745ca52bb20ffb5326b16a8ffe919b9ec65775941b8b35` (unchanged)

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.6 --date 2026-09-30
npm run data:verify
npm run test:fast
```
