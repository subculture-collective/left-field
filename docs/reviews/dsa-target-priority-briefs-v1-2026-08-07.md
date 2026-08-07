# DSA target priority briefs v1 — 2026-08-07

## Outcome

The repository now has a deterministic mechanism for producing readable priority briefs from the provisional v0.2 score and retained member/district facts:

```bash
npm run generate:dsa-target-priority-briefs-v1
```

The generated artifact is `data/metadata/dsa-target-priority-briefs-20260807-v1.json`. It contains exactly 212 records, with a default public opening view of the top 50. Each record includes:

- the provisional rank, score, formula, qualifying route, and four component explanations;
- the incumbent's official House name, birth year, BioGuide ID, House-service dates, cumulative and uninterrupted tenure, district changes, and material service breaks;
- the district's retained 2024 presidential Democratic margin and incumbent cash on hand;
- deterministic `scoreSummary`, `personSummary`, and `districtSummary` prose;
- hashes linking the brief to its exact score and tenure rows;
- a methodology statement that the score is strategic priority, not win probability or endorsement.

The prose is template-generated from retained fields. It does not add free-form biographical claims.

## Ordering and public view

The artifact contains the complete v0.2 order. The order is score descending, then bytewise `seatCycleId` for ties. `/priorities` opens with 50 records and supports search, state and route filters, plus an explicit all-212 view. Every record has a detail route at `/priorities/[seat-id]`.

- ranked universe: 212
- emitted briefs: 212
- default public view: 50
- rank-50 cutoff: 71.4
- seats scoring at least 60: 129
- rank-50 seat: `seat_house_ca_07_current`

## Coverage

The 212 briefs include 91 AIPAC-supported-blue route records and 121 deep-blue route records. Two hundred ten have a retained cash-on-hand value; the other two preserve source missingness. Fifty have at least one recorded district change in their House service history.

## Provenance and lifecycle

Direct retained parents, in order:

1. `dsa-target-provisional-score-20260807-v02`
2. `incumbent-tenure-factual-candidate-20260804-v1`
3. `congress-legislators-current-20260804`
4. `dsa-target-factual-projection-20260804-v1`

The output is `reviewerOnly: false`, `publicationEligible: true`, and `deployed: false` at generation time. Its publication authorization is explicitly owner-directed. It does not claim an independent reviewer identity or approval timestamp.

## Reproduction pins

- output bytes: `932792`
- output SHA-256: `fe0502903e82639f13afa9557354da6066e57e4aad61e2056afdc2560bc32bc4`
- brief-set SHA-256: `6d88dbd6e8e0db95169a936fe98100155215af52c69070e43f70f1399c5b1486`
- package SHA-256: `ce6ca1c48f3f3b907f1c89fa566b2482903fc5cf432306a97edb0b9293327292`

## Verification

```bash
npx vitest run src/domain/dsa-target-priority-briefs-v1.test.ts
npm run typecheck
npm run generate:dsa-target-priority-briefs-v1
npm run data:verify
npm run lint
```
