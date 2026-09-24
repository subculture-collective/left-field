# Priority Index v1.0: Senate scoring, nationwide state-legislative roster, and a refreshable release — 2026-09-24

## Outcome

V1.0 turns the House-only index into a two-chamber list and lays the roster for state legislatures. The House layer is v0.9 unchanged; every House score and rank within the chamber reproduces exactly. The Senate layer is new (v0.1). A release descriptor, a refresh pointer, and two commands replace hand-edited version constants. State-legislative seats are retained with holders and primary evidence but are not ranked, because no open nationwide file gives 2024 presidential results by legislative district.

## Chamber-agnostic scorer

`src/lib/seat-score.ts` holds the two routes as pure functions. Both routes omit missing components, renormalize the present weights, and scale by `0.6 + 0.4 × available weight`. The House v0.9 Republican route is reproduced by the same code; the Democratic route generalizes the v0.9 Democratic formula with the same coverage rule the Republican route already used.

| Route | Structural | Final |
|---|---|---|
| Democratic caucus | `0.70 × blue baseline + 0.30 × primary feasibility` (baseline alone when feasibility is missing) | `renormalized(0.65 structural + 0.20 alignment gap + 0.15 cash) × (0.6 + 0.4 W)` |
| Republican | — | `renormalized(0.45 competitiveness + 0.20 cash + 0.15 local context + 0.20 state contestation) × (0.6 + 0.4 W)` |

## Senate v0.1

Inputs, all lock-verified: `congress-legislators-current-20260804` (100 senators, class, party, term end, FEC ids), `statewide-presidential-2024-v1` (parsed from the Clerk's 2024 statistics text: 51 jurisdictions, 155,408,991 votes, 20 Democratic and 31 Republican wins), `fec-candidate-summary-2026-20260924` (the FEC `weball26` file, 4,294 candidates), the "119th Senate" sheets of the two alignment trackers (47 rows, joined by state and last name with the roster nickname as tie-breaker), and `rapid-state-legislative-primary-context-v1`.

| Measure | Value |
|---|---:|
| Seats | 100 (47 Democratic caucus incl. 2 independents, 53 Republican) |
| Up in 2026 | 35 (33 Class II, 2 appointed Class III specials) |
| Cash values | 98 (two appointees have no FEC candidate row) |
| Alignment values | 47 of 47 Democratic caucus |
| State contestation values | 8 Republican seats |
| Highest Democratic-route score | 76.8 (MD-S1) |
| Highest Republican-route score | 65.8 (WI-S3) |

Primary feasibility is not measured for senators, so the Democratic structural baseline is the blue baseline alone and every brief says so. Independents caucusing with Democrats take the Democratic route and are labelled. The public list ranks House and Senate together; the page offers chamber and next-election filters.

## State-legislative roster

`state-legislative-roster-v1` reads the 51 Open States people CSVs (CC0, retained 2026-09-24): 7,344 legislators, 100 chambers, 3,236 Democratic and 4,032 Republican holders, 406 multi-member districts. Democratic holders in the ten catalog states are joined to their latest retained Democratic primary through an exact given-and-family-name gate: 339 match and carry a direct primary feasibility value; 74 do not appear in the latest retained contest.

These seats are not ranked. The Downballot publishes legislative-district presidential results only through 2020 and asks that whole sheets not be reproduced; Dave's Redistricting has no bulk export; MEDSL's CC0 2024 precinct returns lack district assignments. The roster records the reason and will score once a district baseline is retained.

## Release and refresh

- `data/metadata/priority-index-release.json` (pinned) is the only place the model version, publication date, and per-chamber cutoffs live. The store and pages read it.
- `data/metadata/refresh-inputs.json` (pinned) names the dated FEC and roster snapshots; the Senate and roster builders read the pointer, so a refresh edits data, not code.
- `npm run rapid:refresh` retains today's FEC summary and rosters under dated paths, pins them with their public URLs, and rewrites the pointer. `npm run rapid:publish -- --version vX.Y` re-derives every registered artifact in order, writes and pins the release descriptor, writes a review-note skeleton with digests, and runs the lock verifier.
- `.github/workflows/refresh.yml` runs both weekly and opens a pull request; a person reviews the diff and merges.

## Immutable outputs

- `statewide-presidential-2024-v1`: package `e41c1361f9a93e481e14bba9b017cac282360c3b27aa8cd34a8d1746338bd24f`.
- `senate-score-v01-projection-v1`: package `98c1d33973f8edc31bcaa722aa1385f69fe5a69e73bbda1ba13659b94fb6effc`.
- `state-legislative-roster-v1`: package `c042e4df9da2356999cc49c5724687bdaacf6aac700e19e3b0158c50f017b03a` at first build; the district-key fix (named districts keep their digits) changed the pinned package. `data/source-lock.json` holds the current digest.
- `house-score-v09-active-projection-v1`: unchanged, package `b10ae4d65e815c1d207f9f87660082770db4783ea9a0e4515a8ee32df5e1a4b4`.

## Reproduction

```sh
npm run rapid:refresh -- --date 2026-09-24 --skip-download
npm run rapid:publish -- --version v1.0 --date 2026-09-24
npm run data:verify
npm run typecheck
npm run lint
npx vitest run src/lib src/rapid-acquisition/senate-score-v01.test.ts src/rapid-acquisition/state-legislative-roster.test.ts src/rapid-acquisition/statewide-presidential-2024.test.ts src/ui
```
