# DSA target evaluation reviewer report — 2026-08-04

## Decision

Retain `dsa-target-evaluation-review-report-20260804-v1` as a proposed, reviewer-only partial evaluation. Do not publish it, expose it through an application route, or describe it as a completed ranking. It advances factual evaluation work without treating unreviewed AIPAC research as data.

## Exact scope

The projection was exported read-only from the published production release `rel_full_20260804_v2` at source cutoff 2026-08-04. Its universe is exactly 212 occupied, regular, voting U.S. House seats held by Democrats.

| Input | Numeric values | Explicit missing | Meaning |
| --- | ---: | ---: | --- |
| Geography-compatible 2024 Democratic presidential margin | 212 | 0 | Factual election input for every eligible seat |
| Incumbent cash on hand | 210 | 2 | Factual finance input; MD-04 and NY-04 are `not_reported`, never zero |
| Compatible 2020 presidential margin | 0 | 212 | `not_collected` |
| Prior Democratic primary margin | 0 | 212 | `not_collected` |
| Incumbent tenure | 0 | 212 | `not_collected`; current-term membership dates were not misused as first-service dates |
| Filing runway | 0 | 212 | `not_collected` |
| Prior Democratic primary votes | 0 | 212 | `not_collected` |
| Prior progressive primary share | 0 | 212 | `not_collected` |
| Reviewed AIPAC transaction evidence | 0 | 212 | Unreviewed proposal packages are excluded |

The source lock classifies the projection as a `production_projection_receipt`: its production inputs are immutable database-resident release records rather than local source-lock parents. The receipt binds release-manifest schema version 2, canonical-data checksum `f365df475ca0134d7d98dc5b07ebffcd51425a3532a61f1806f1dfd0b2fa5fc1`, geometry checksum `c8f32c4071ff7d259d5fa0d26acdde107bb09aab7f9388b47ea293d1adf1a628`, content checksum `435fb6c1cca524dc24ee2cc81113116d2f238cb278b8da3995fd427289950896`, and all approved snapshot checksums into production-release closure `3602a80fc16e92e82a214b14ceca9fe4c92e14cc7eea0de59921767b68723ab6`.

Projection file SHA-256 is `e1c2ab02cafb2ee438ec1a1c936f903e38cc19553d187b6b2d1dca55dc99d3ec`; its domain-separated projection hash is `5ff3416817d062bafff21a8ad7e7ff2c87e39b627638f55646de8a540af80edd`. The generated report file SHA-256 is `35224f69d401ffee69f88c5a2f7289b12aa50dca7b3d171c444acfecfa35a644`; its domain-separated report hash is `87a74fc61082005c6ef3395ffe88412abaccbf370d6389b3eb481c8d686a1c52`.

## Result and interpretation

The partial evaluator produces 117 deep-blue qualifications and 95 non-qualifications. Zero rows contain numeric AIPAC evidence and zero rows select the AIPAC-supported-blue route. A qualifying partial row means only that the available factual presidential-margin evidence clears the deep-blue route and the evaluator applied its documented partial-coverage penalty. It does not mean the seat is campaign-ready or more likely to be won.

The leading partial rows are shown only to make the calculation auditable:

| Partial rank | Seat ID | Target score | Blue baseline | Partial feasibility |
| ---: | --- | ---: | ---: | ---: |
| 1 | `seat_house_il_01_current` | 90.4 | 100.0 | 68.0 |
| 2 | `seat_house_nc_04_current` | 90.4 | 100.0 | 68.0 |
| 3 | `seat_house_ny_09_current` | 90.4 | 100.0 | 68.0 |
| 4 | `seat_house_wi_04_current` | 90.4 | 100.0 | 68.0 |
| 5 | `seat_house_ny_13_current` | 90.0 | 100.0 | 66.7 |
| 6 | `seat_house_ga_05_current` | 88.5 | 100.0 | 61.8 |
| 7 | `seat_house_pa_03_current` | 88.5 | 100.0 | 61.8 |
| 8 | `seat_house_ny_16_current` | 87.3 | 100.0 | 57.7 |
| 9 | `seat_house_il_07_current` | 87.1 | 100.0 | 56.9 |
| 10 | `seat_house_ma_07_current` | 86.8 | 100.0 | 56.0 |

Ties are resolved bytewise by stable seat ID. These ranks will move as missing factual inputs are acquired, so they must not be copied into the public product.

## AIPAC proposal firewall

The report records the file and package hashes of four proposal inputs: candidate/seat mappings, evidence closure, network classification, and the decision queue. Each remains `review.status = proposed` and is included only as an exclusion reference. The evaluator receives a null incumbent FEC candidate mapping, an empty evidence list, and incomplete coverage for all three cycles and both AIPAC channels. Positive AIPAC evidence is rejected when the incumbent mapping is null.

The formula-only sensitivity cases are synthetic and labeled as such. A synthetic $1,000 direct contribution produces an AIPAC component of 55 and route score 44.5; a synthetic $10,000 contribution produces 100 and 71.5. These cases prove monotonicity and the intended 60% AIPAC route weight. They assert nothing about a real candidate or seat.

## Reproduction and checks

The factual projection exporter requires a read-only database connection to the named release. Once that locked projection exists, report generation is local and deterministic:

```bash
npm run generate:dsa-target-review-report
npm test -- --run src/domain/dsa-target-evaluator.test.ts src/domain/dsa-target-review-report.test.ts
npm run data:verify
```

The generator re-hashes the projection and all four proposals against `data/source-lock.json`, validates the projection's internal production-release closure, validates each proposal's internal package hash and proposed review status, validates the complete report schema, and fails closed on any mismatch. It uses exclusive-create semantics and accepts an existing report only when its bytes are identical; a differing output is never overwritten. The report is a retained `review_proposal` whose parents include the factual projection and all four excluded proposal packages.

## Remaining factual work

The next completeness work should fill compatible 2020 district presidential margins and prior-primary results with source-locked, reviewed nationwide cohorts. Incumbent tenure needs an authoritative first-service source rather than current membership start dates. AIPAC scoring remains gated on independent decisions for all 231 queue items and a reviewed evidence build; mechanism completion alone does not approve those facts.
