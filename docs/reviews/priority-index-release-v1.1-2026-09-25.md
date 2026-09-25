# Priority Index v1.1: House v0.10 finance refresh — 2026-09-25

## Outcome

V1.1 makes the House layer refreshable. `house-score-v10-active-projection-v1` carries every v0.9 component unchanged and replaces incumbent cash on hand with the FEC candidate summary snapshot named by the refresh pointer (`fec-candidate-summary-2026-20260924`, the FEC `weball26` file). The builder first reproduces every v0.9 score from the old cash with the same formulas, so a formula drift fails the build; only then does it apply the new cash. The Senate layer is unchanged.

| Measure | Value |
|---|---:|
| Seats with a snapshot row | 424 of 430 |
| Seats keeping the release aggregate | 6 (MD-04, MT-01, NJ-12, NY-04, TX-03, TX-32: no principal-campaign row for the incumbent's House candidate id) |
| Scores changed | 137 |
| Largest movement | 22.4 points |
| Latest filing coverage | 2026-08-26; 298 seats through 2026-06-30 |

## Largest movements

| Seat | Party | v0.9 | v0.10 | Movement | Cash on hand |
|---|---|---:|---:|---:|---|
| TX-38 | R | 14.3 | 36.7 | +22.4 | $2,487,176 → $29,183 (2026-06-30) |
| GA-01 | R | 38.3 | 57.2 | +18.9 | $3,018,930 → $59,610 (2026-06-30) |
| LA-05 | R | 7.6 | 26.5 | +18.9 | $1,346,767 → $0 (2026-08-21) |
| IA-04 | R | 8.3 | 26.5 | +18.2 | $1,170,394 → $0 (2026-06-30) |
| OK-01 | R | 16.7 | 34.7 | +18.0 | $1,148,666 → $0 (2026-06-30) |
| MI-10 | R | 55.0 | 70.4 | +15.4 | $734,681 → $0 (2025-12-23) |
| IL-08 | D | 40.2 | 55.2 | +15.0 | $17,111,494 → $48,254 (2026-06-30) |
| TN-06 | R | 16.7 | 31.0 | +14.3 | $983,754 → $45,291 (2026-06-30) |

The top of the combined list is unchanged in character: NY-16 85.4, NY-13 83.6, PA-03 81.0, GA-05 80.8, IL-01 80.1.

## Caveat: members leaving the House

Several of the largest drops in cash belong to incumbents whose House committee has wound down because they are retiring or running for another office (IL-08's House committee shows $48,254 while the member's Senate committee holds the funds). The index still labels this as incumbent cash vulnerability. For a flip screen an open seat is a real opportunity, but the driver text is wrong about why. The next refresh step is an open-seat flag from the FEC candidate status and the filed-candidate list, so those rows say "incumbent not seeking re-election" instead of "vulnerable incumbent".

## Release mechanics

- The release descriptor now records `financeAsOf` per chamber; `rapid:publish` sets the House artifact to v0.10 and the finance date to the refresh snapshot.
- `rapid:refresh` followed by `rapid:publish -- --version vX.Y` re-derives v0.10 from a new snapshot with no code change. The House structural cutoff stays 2026-08-04.
- The methodology and sources pages read the v0.10 briefs; the cash component copy names the snapshot.

## Immutable outputs

- `house-score-v10-active-projection-v1`: 373,592 bytes; SHA-256 `dc7d05776f71ca8c477b3f60e0be3945bcdf3d3e481378a6bc7f62d586cceca8`; row set `06d100bd09a997b71e3e6ba936ef592c5f6fa965c10850b50ca390203edc67fb`; package `2ef951affcd6d98b1ead93cf35d402d26bb0cdd44755440a31ace97bdc8cc402`.
- `house-score-v09-active-projection-v1`: unchanged.
- `priority-index-release-v1`: modelVersion v1.1, published 2026-09-25.

## Reproduction

```sh
npm run rapid:intake -- derive house-score-v10-active-projection-v1
npm run rapid:publish -- --version v1.1 --date 2026-09-25
npx vitest run src/rapid-acquisition/house-score-v10-active.test.ts src/lib src/ui
npm run typecheck
npm run lint
npm run data:verify
```
