# Texas House Democratic primary canvass receipt

Date: 2026-08-05  
Status: proposed reviewer-only evidence; not approved, published, selected, or evaluator-integrated

## Outcome

The receipt retains all six Texas Secretary of State **Official Canvass Report** artifacts for the 2022, 2024, and 2026 Democratic regular primaries and runoffs, and exactly extracts and reconciles their observed U.S. House Democratic contest rows. It closes:

- 6 event reports: 3 regular primaries and 3 runoffs;
- 119 observed U.S. House district-event contests;
- 269 source candidate rows;
- 4,197,819 candidate votes, each contest reconciled exactly to its printed total;
- 28 printed incumbent markers; and
- 109 district-event rows not observed in the retained official canvass report, each explicitly unresolved rather than converted to zero, no candidate, uncontested, or no runoff.

Artifact: `data/metadata/texas-house-democratic-primary-results-2022-2026-v1.json`  
Artifact SHA-256: `fa5db68682dd7f3183e834e881ddac016833065c5424dc1c95b92cddb489488e`  
Package SHA-256: `f010c5c0a4915d2c73feb46e7cf6617e109e1c7bfc6e1b94449e393410e809e1`  
Contest-set SHA-256: `10ac515b35866e680ca1741a30136e364fbaffff0248c87648f85204c98eb9ba`

## Acquisition boundary

The Texas Secretary of State archive routes 2019–2024 results to the historical Texas election-results application and 2025-current results to the Civix application. The exact report IDs are 47011, 47293, 49665, 50026, 53814, and 58314.

The four historical report URLs challenge non-browser command-line requests. They were retrieved through the public browser application, imported through `TX_PRIMARY_HISTORICAL_IMPORT_DIR`, and accepted only after exact byte-size, SHA-256, PDF signature, document-title, event-date, publisher, and extraction checks. The two 2026 reports are decoded directly and reproducibly from the current official API's base64 `upload` field. The fetcher refuses historical imports whose bytes differ from the lock.

```bash
TX_PRIMARY_HISTORICAL_IMPORT_DIR=/path/to/hash-pinned-reports npm run fetch:tx-house-primary-results
npm run generate:tx-house-primary-results-receipt
```

The historical import directory must contain:

- `tx-2022-democratic-primary-official-canvass.pdf`
- `tx-2022-democratic-primary-runoff-official-canvass.pdf`
- `tx-2024-democratic-primary-official-canvass.pdf`
- `tx-2024-democratic-primary-runoff-official-canvass.pdf`

## Review and decision lifecycle

This artifact is bound to source-selection proposal `house-democratic-primary-source-selection-proposal-20260804-v1`, file SHA-256 `85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1`, package SHA-256 `a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb`.

It creates no decision. Generation validates the exact parent proposal file/package and fails closed unless both inherited decisions remain present with `resolution: null`. It provides evidence to the already-bound `decide-nonstandard-primary-disposition-treatment-v1` decision under lifecycle `evidence_for_bound_existing_decision_not_an_independent_decision`.

The PDFs support an official-canvass result status, but this receipt does not independently bind them to a separate signed, sealed, or statutory final-certification authority. Certification therefore remains `official_canvass_report_retained_certification_not_separately_bound`, and exact-scope certification reconciliation remains an open gate.

Every contest remains:

- `reviewerOnly: true` at package level;
- `publicationEligible: false`;
- review status `proposed`, with reviewer, reviewed timestamp, and resolution null;
- source winner unmarked, with no winner inferred from vote totals;
- regular/runoff related only by cycle, party, and district—not automatically selected or substituted;
- current identity and historical geography not reviewed;
- selection status `unselected`;
- evaluator values null; and
- `scoreEligible: false`.

## Validation

```bash
npm run test:run -- src/ingestion/elections/texas-house-democratic-primary-results-receipt.test.ts
npm run data:verify
npm run typecheck
```

The focused tests reproduce the stored artifact from the twelve locked inputs, exercise wrapped candidate-name extraction, assert event closure and unresolved absences, and reject a fully rehashed invented winner.
