# DSA target provisional score v0.2 — 2026-08-07

This deadline calculation adds the two user-supplied 119th House trackers to the existing 212-seat evaluator report and produces a public priority index for every seat. It is a strategic ordering, not a win probability or endorsement.

## Inputs and assumption

- Congressional Democrat Left Tracker: Google Drive file `1gPBdBrqVCbtuy7f1bjOdCDUzEv5RqbbU1yYAr3KoHYE`, modified `2026-08-04T19:39:13.817Z`; retained XLSX SHA-256 `f7b55863e7cf6528c87796cf2f955f1bf3ac588db4e76bb51b88817591be99ff`.
- Congressional Democrat Palestine Tracker: Google Drive file `1VU1y_jSb2hanU2MrLsjRx8tujB-C--UAQ2EahaTXGUo`, modified `2026-07-30T17:48:22.629Z`; retained XLSX SHA-256 `e90ee9bfa19052fc506d706aa98c9c1f48a392115b430ff392c175255f18e9d5`.
- Baseline: `dsa-target-evaluation-review-report-20260805-v6`, which supplies district baseline, cash, tenure, and the FEC-derived AIPAC component.
- Assumption status: `owner_directed_assumed_correct_for_deadline`. This records the owner's direction to publish the calculation. It does not fabricate an independent reviewer identity, approval timestamp, or source-check result.

The extractor closes 212 Left rows and 212 Palestine rows against the current target universe. It preserves two Palestine scores as missing (`NJ-11`, `TX-18`) and applies the documented Lucy McBath identity remap from the Palestine tracker’s `GA-07` source label to current `GA-06`. AIPAC and DMFI text labels are retained as context but are not added numerically because the baseline already contains the transaction-based AIPAC component.

## Formula

```text
left_gap       = 100 * (1 - left_score)
palestine_gap  = 100 * (1 - palestine_score)
alignment_gap  = mean(left_gap, palestine_gap)

priority_score = 0.75 * baseline_structural_score
               + 0.25 * alignment_gap
```

For the 140 seats that qualified under v0.1, `baseline_structural_score` is the original selected route score. The other 72 seats use a bounded component fallback so the entire field can be ordered without converting missing observations to zero:

```text
deep_blue_fallback = 0.70 * blue_baseline + 0.30 * primary_feasibility
aipac_fallback     = 0.60 * aipac_support + 0.25 * blue_baseline
                   + 0.15 * primary_feasibility
baseline_structural_score = max(available fallback routes)
```

For the two missing Palestine scores, the available Left gap is multiplied by the same missingness factor used by the existing evaluator: `0.6 + 0.4 * coverage`, with coverage `0.5`. Missing AIPAC values simply make the AIPAC fallback unavailable; they are not changed to zero.

## Result

- 212 seats represented.
- 212 seats ranked; 140 preserve the v0.1 qualified route and 72 use the universal component fallback.
- 210 full alignment observations; 2 partial observations.
- 91 AIPAC-route seats and 121 deep-blue-route seats.
- Owner-directed publication authorization is recorded; no independent reviewer identity or approval timestamp is claimed.

Top ten:

| Rank | Seat | Incumbent | Score | Route | Alignment gap |
|---:|---|---|---:|---|---:|
| 1 | NY-16 | George Latimer | 85.0 | AIPAC-supported blue | 56.7 |
| 2 | CA-36 | Ted Lieu | 82.3 | AIPAC-supported blue | 60.5 |
| 3 | GA-06 | Lucy McBath | 82.1 | AIPAC-supported blue | 68.5 |
| 4 | MO-01 | Wesley Bell | 80.9 | AIPAC-supported blue | 51.0 |
| 5 | CA-19 | Jimmy Panetta | 80.4 | AIPAC-supported blue | 68.6 |
| 6 | NY-13 | Adriano Espaillat | 80.4 | AIPAC-supported blue | 48.8 |
| 7 | NY-15 | Ritchie Torres | 80.3 | AIPAC-supported blue | 64.0 |
| 8 | MA-05 | Katherine Clark | 79.8 | AIPAC-supported blue | 53.8 |
| 9 | OH-11 | Shontel Brown | 79.5 | AIPAC-supported blue | 52.4 |
| 10 | MD-04 | Glenn Ivey | 78.6 | Deep blue | 53.2 |

## Remaining data

The calculation runs without converting missing values to zero. Four original v0.1 inputs remain absent nationwide: prior-primary margin, Democratic-primary turnout, prior progressive-primary share, and state-authority filing runway. The trackers are incumbent ideology inputs and are deliberately not relabeled as progressive-primary performance. The next acquisition work should fill primary margin and turnout from retained state result packages first, then add the 16 still-unretained states; progressive challenger classification remains a distinct relationship task.

## Reproduction

```bash
npm run generate:incumbent-alignment-tracker-v1
npm run generate:dsa-target-provisional-v02
npm run test:run -- src/domain/dsa-target-provisional-score-v02.test.ts
npm run typecheck
npm run data:verify
```

Artifacts:

- `data/metadata/incumbent-alignment-tracker-candidate-20260807-v1.json`
- `data/metadata/dsa-target-provisional-score-20260807-v02.json`
