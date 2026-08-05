# House filing-runway authority proposal — 2026-08-04

## Decision

Retain the FEC 2026 congressional primary/deadline chart as a nationwide discovery and drift-detection source. Retain the 38-state/212-seat transcription as a proposed authority package. Do not place any filing-runway number into the evaluator or public interface until the exact state authority and nomination path are retained and reviewed.

## Exact source and boundary

The Federal Election Commission chart is `2026 Congressional Primary Dates and Candidate Filing Deadlines for Ballot Access`, data as of 2026-05-18. It states that dates are subject to change, cites state election offices/statutes/state parties, says the FEC does not administer elections, and directs procedural questions to state election directors.

- URL: `https://www.fec.gov/resources/cms-content/documents/2026pdates.pdf`
- bytes: 226,820
- SHA-256: `9a5d4ec0ba2b69daf2f510ef79bca0ca381ab699255ac5adb971b9672d517251`
- target universe: exact 212-seat production projection from `rel_full_20260804_v2`
- target states: 38

This makes the chart a useful complete enumerator, not controlling state authority.

## Proposed metric

`filingRunwayDays` should be the nonnegative UTC calendar-day difference between the 2026-08-04 source cutoff and the final normal ballot-access deadline for a prospective non-incumbent on the election path applicable to the exact seat.

- A confirmed passed deadline produces numeric zero.
- An unknown or unretained deadline remains missing and never becomes zero.
- Primary election dates, campaign-finance reporting deadlines, independent/minor-party deadlines, write-in deadlines, certification events, and vacancy contingencies are not substitutes.
- Where the FEC distinguishes incumbent and all-other candidates, use the all-other deadline for a prospective challenger.
- Numeric use requires both retained state authority and formula compatibility.

## Exact proposal result

| Measure | Count |
| --- | ---: |
| Target states / seats | 38 / 212 |
| FEC discovery deadlines | 38 |
| FEC discovery zero-day seats | 210 |
| FEC discovery positive-day seats | 2 |
| State-authority-confirmed seats | 0 |
| Evaluator numeric values | 0 |
| Missing state-authority seats | 212 |
| Proposed formula-incompatible seats | 52 |
| Path-specific review seats | 13 |
| Other unassessed formula seats | 147 |

The only positive discovery values are LA-02 and LA-06 at three days because the chart lists the Louisiana House qualifying deadline as August 7. They remain missing for evaluation: live official discovery indicates Louisiana uses a November open primary, not the partisan Democratic-primary path assumed by v0.1.

California, Louisiana, and Washington account for 52 seats and are proposed incompatible with the current `partisan_primary_general` program because their relevant routes are top-two/open rather than ordinary Democratic primaries. Alabama, Connecticut, and Virginia account for 13 path-specific review seats because special-primary, endorsement/petition, or party-nomination choices cannot safely collapse to a statewide scalar without retained state evidence.

## Decision queue

1. Approve the FEC chart for discovery/drift detection only.
2. Approve the nonnegative calendar-day definition, including zero only for a confirmed passed deadline.
3. Classify CA/LA/WA as retained all-seat rows but ineligible for v0.1 unless the formula is revised.
4. Retain controlling authority for all 38 states, with structured path evidence for AL/CT/VA and district-specific extensions where applicable.

Every decision defaults to `retain_discovery_exclude_from_evaluator_and_publication`. The proposal blocks publication but not continued state-authority acquisition.

## Reproduction

```bash
npm run fetch:fec-2026-primary-calendar
npm run generate:filing-runway-authority-proposal
npm test -- --run src/ingestion/elections/house-filing-runway-authority-proposal.test.ts
npm run data:verify
```

The fetcher refuses source drift against the exact retained PDF hash. The generator re-hashes both source-lock parents, validates the production projection, enforces exact 38-state and 212-seat closure, domain-hashes every state/seat row and the package, and uses exclusive-create conflict semantics.

## Remaining work

Collect and retain controlling state authority; do not ask a reviewer to hand-enter 38 dates. The first authority packet should resolve CA/LA/WA formula scope and AL/CT/VA path semantics, then batch the routine states. In parallel, primary-result acquisition needs a separate 2022/2024/2026 source-selection and geography/identity proposal: production currently contains zero usable Democratic House-primary results for all 212 seats.
