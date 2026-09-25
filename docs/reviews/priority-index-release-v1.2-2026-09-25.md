# Priority Index v1.2: House v0.11 open seats from Senate filings — 2026-09-25

## Outcome

V1.2 closes the caveat recorded in v1.1. `house-incumbent-candidacy-v1` reads the FEC candidate master snapshot (`fec-candidate-master-2026-20260925`, the FEC `cn26` file, now retained by `rapid:refresh` beside the candidate summary) and records, per House seat, whether the incumbent's House candidate ids carry statutory candidate status for 2026 and whether a 2026 Senate filing in the same state matches the incumbent's name. Sixteen incumbents have filed for the Senate. `house-score-v11-active-projection-v1` treats those seats as open: the incumbent-specific components are omitted and the present weights renormalized, the same rule the index applies to any missing component.

| Route | Open-seat treatment |
|---|---|
| Democratic | cash and alignment omitted; score = structural baseline |
| Republican | cash omitted; v0.9 route over competitiveness, local context, and state contestation |

Every other seat carries v0.10 unchanged. The FEC status field is not a re-election signal (427 of 430 incumbents hold statutory status regardless of intent), so it is recorded but not used to infer retirements. Runs for governor or other state office are invisible in federal filings; seats such as IA-04, MI-10, and TN-06, whose House committees emptied in v1.1, remain unchanged and the caveat still applies to them.

## Name gate

A Senate filing matches an incumbent when the last-name key is identical and the FEC given tokens contain one of the roster's given-name tokens (first, middle, nickname, official full name), or the first token is an initial of one of them, or the first token is a bare initial and the last name is unique among that state's 2026 Senate filings. The basis is recorded on every row. This admitted "MOORE, FELIX BARRY" for Barry Moore (AL-01) and "KRISHNAMOORTHI, S" for Raja Krishnamoorthi (IL-08).

## Open seats

| Seat | Party | v0.10 | v0.11 | Movement |
|---|---|---:|---:|---:|
| TX-30 | D | 74.9 | 81.3 | +6.4 |
| IL-02 | D | 72.2 | 77.0 | +4.8 |
| MI-11 | D | 77.9 | 75.7 | −2.2 |
| MN-02 | D | 72.6 | 65.4 | −7.2 |
| MA-06 | D | 49.1 | 51.8 | +2.7 |
| IL-08 | D | 55.2 | 45.3 | −9.9 |
| GA-01 | R | 57.2 | 42.9 | −14.3 |
| KY-06 | R | 28.4 | 31.1 | +2.7 |
| TX-38 | R | 36.7 | 13.4 | −23.3 |
| WY-AL | R | 18.8 | 12.5 | −6.3 |
| OK-01 | R | 34.7 | 10.8 | −23.9 |
| SC-05 | R | 28.4 | 6.9 | −21.5 |
| NH-01 | D | 16.8 | 1.4 | −15.4 |
| AL-01 | R | 12.0 | 0.0 | −12.0 |
| LA-05 | R | 26.5 | 0.0 | −26.5 |
| SC-07 | R | 9.0 | 0.0 | −9.0 |

The large drops on the Republican side undo the v1.1 cash-collapse inflation for those seats. NH-01 falls because an open seat in a near-even district has no primary-opportunity structure; the index is a primary and flip screen, not a general-election watch list. The priorities list and each brief label these rows "open seat" and the drivers say which components were omitted and why.

## Immutable outputs

- `house-incumbent-candidacy-v1` and `house-score-v11-active-projection-v1`: digests in `data/source-lock.json`.
- `priority-index-release-v1`: modelVersion v1.2, House layer v0.11.

## Reproduction

```sh
npm run rapid:intake -- derive house-incumbent-candidacy-v1
npm run rapid:intake -- derive house-score-v11-active-projection-v1
npm run rapid:publish -- --version v1.2 --date 2026-09-25
npx vitest run src/rapid-acquisition/house-score-v11-active.test.ts src/lib src/ui src/app
npm run typecheck
npm run lint
npm run data:verify
```
