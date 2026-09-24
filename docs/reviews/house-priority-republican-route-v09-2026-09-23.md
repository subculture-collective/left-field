# House Priority Index v0.9: coverage-scaled Republican route, state primary context, reviewed alias — 2026-09-23

## Outcome

V0.9 removes the flat 0.70 multiplier on Republican-held seats and replaces it with the partial-coverage rule the Democratic route already uses. It adds a state-level Democratic primary contestation component fed by the retained state-legislative catalogs, and it resolves RI-01 through a reviewed identity alias so its direct 2024 primary evidence applies. 217 of 430 scores change: 216 Republican-held seats and RI-01. Every other Democratic score reproduces v0.8 exactly. No route changes.

## Republican route

```text
components  competitiveness 0.45 · cash vulnerability 0.20 · exact at-large local context 0.15 · state Democratic primary contestation 0.20
W           sum of the weights whose component is present
score       (Σ weight × component) / W × (0.6 + 0.4 W)
```

The former cap gave every Republican seat a 0.70 multiplier regardless of evidence. The new multiplier ranges from 0.78 with only competitiveness present to 1.0 with all four components, so the penalty is for missing evidence, not for party. No seat is clamped.

| Seat | v0.8 | v0.9 | Available weight | Rank now |
|---|---:|---:|---:|---:|
| AZ-01 | 63.5 | 78.6 | 0.65 | 9 |
| NE-02 | 64.8 | 78.1 | 0.65 | 10 |
| OH-10 | 48.8 | 60.2 | 0.85 | 63 |
| ND-AL | 13.6 | 18.7 | 0.80 | 372 |

The top eight seats remain Democratic primary targets. Republican median moves from 12.9 to 19.5. Largest single movement is 21.8 points; 14 movements exceed the 13-point cap earlier versions enforced, which is expected when a flat multiplier is removed, so v0.9 records that count instead of failing on it.

## State Democratic primary contestation

`rapid-state-legislative-primary-context-v1` reads all twelve retained local-context catalogs through the source lock and counts, per state and cycle, Democratic contests, contests with more than one named candidate, and Democratic votes (2,109 contests, 825 contested, 14,331,440 votes across 28 state-cycle rows). A contested share becomes a 0..100 score with 100 at a 40% contested share.

Only catalogs that record uncontested contests can produce a comparable share. Alabama, Delaware, Kentucky, and both North Carolina catalogs retain contested primaries only and are marked ineligible with the reason recorded. County and local-office catalogs (New Mexico, North Carolina) are retained but not used for a state-legislative measure. Six states carry a score, applied to their 40 Republican-held seats:

| State | Cycle | Contested share | Score |
|---|---|---:|---:|
| GA | 2026 | 31.7% | 79.3 |
| HI | 2024 | 41.9% | 100 |
| IN | 2024 | 9.8% | 24.5 |
| MO | 2024 | 12.8% | 32 |
| OH | 2026 | 20.4% | 51 |
| TN | 2024 | 16.1% | 40.3 |

This is a state-level organizing proxy, labelled as such in every brief. It is not a district measure and infers no winner or holder.

## Reviewed identity alias

`house-identity-aliases-v1` (kind `editorial_ledger`) records one reviewed alias: bioguide A000380, "Gabe Amo", RI-01, source spelling "Gabriel Amo" in `rapid-house-primary-structured-results-v1`. `rapid-house-primary-2024-incumbent-evidence-v2` carries every v1 row unchanged and resolves RI-01 through that alias with identity status `reviewed_alias_relationship`. All 22 observations are now formula-eligible; the incumbent took 100% of the retained 2024 contest votes, so primary feasibility is 0 and RI-01 moves from 59.6 to 55.9.

## Immutable outputs

- `rapid-state-legislative-primary-context-v1`: 19,004 bytes; SHA-256 `e93024ea3dabbf5f07762dd85a0ae4688822882e39b8fade133c97870acf7e89`; package `0da8bd2a52533aa29995b477b4df70f485b810f6021c2ef796a7e4f6745d7658`.
- `house-identity-aliases-v1`: 971 bytes; SHA-256 `eb3a046b39ada370b05eb2a7c17f25cc1967d474bba044c05e02c50c1238662a`.
- `rapid-house-primary-2024-incumbent-evidence-v2`: 26,734 bytes; SHA-256 `4cd439117287831277f9aff40842c598c04ddd33c9cd1348dafe739e38aa76d2`; package `4b6407987d7cfbe1ec2d16c3a79edb96f1237bd75d1a02903532e923d99226b7`.
- `house-score-v09-active-projection-v1`: 507,956 bytes; SHA-256 `cdbefeef90ef0d606ac6f892e4f14bb92e03975cd209d97745fa44eca6d73bd1`; row set `68ee8c21d25adf5d58d6af99aad0feb1074c68e0c2c6622a2e4dca1536f4ac95`; package `b10ae4d65e815c1d207f9f87660082770db4783ea9a0e4515a8ee32df5e1a4b4`.

## Reproduction

```sh
npm run rapid:intake -- derive rapid-state-legislative-primary-context-v1
npm run rapid:intake -- pin house-identity-aliases-v1 data/metadata/house-identity-aliases-v1.json editorial_ledger
npm run rapid:intake -- derive rapid-house-primary-2024-incumbent-evidence-v2
npm run rapid:intake -- derive house-score-v09-active-projection-v1
npx vitest run src/rapid-acquisition/state-legislative-primary-context.test.ts src/rapid-acquisition/house-primary-incumbent-evidence-v2.test.ts src/rapid-acquisition/house-score-v09-active.test.ts src/lib/house-priority-index.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The `rapid-expansion-status` panel still describes the v0.8 local-context expansion layer and reads that frozen artifact; it is unchanged by v0.9.
