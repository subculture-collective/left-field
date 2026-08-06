# Connecticut primary evidence review package v2 — 2026-08-06

Status: proposed reviewer queue; not approved, evaluator-eligible, score-bearing, published, or deployed.

## Outcome

This package integrates three independently source-locked reviewer artifacts into one ten-row cycle/district queue:

1. the v1 identity/geography joint package;
2. the official general-election crosscheck receipt; and
3. the cycle-specific statutory-authority receipt.

Every row retains the official Democratic general-election appearance and the source-specific elected-declaration status. The 2022 rows say only that the exact elected declaration is not present in the retained 2022 instrument; the 2024 rows retain the exact-scope canvass declaration. Neither observation is converted into a primary-nomination mechanism, primary result, winner, or certification claim.

## Lifecycle boundary

All ten rows retain:

- `primaryNominationStatus: null`
- `resultStatus: null`
- `statutoryTriggerFactsResolved: 0`
- `statutoryNominationConclusion: null`
- `approved: false`
- `scoreEligible: false`
- evaluator exclusion pending independent evidence and publication review

The package itself remains `reviewerOnly: true`, `publicationEligible: false`, with a proposed review and null reviewer, timestamp, and resolution. It inherits no approval from any parent and performs no automatic approval.

## Integrity and lineage

Direct parents are exactly:

1. `connecticut-primary-identity-geography-review-package-v1`
2. `connecticut-general-election-crosscheck-receipt-v1`
3. `connecticut-nomination-statutory-authority-receipt-v1`

- Artifact: 17,107 bytes; SHA-256 `a507d8094dc0a69f111202e3b9fc8d352575574ef82f6654f131c4088ac69f86`
- Review-record set: `765cc095a9847913fc7003487a89071d3d5425e1c53c839c65aaf86b8fbe765a`
- Package: `44cd85918cd7ccdc9e174ce11b37dfbb72ca28a150e35b61360a57c4298d9c73`

```bash
npm run generate:ct-primary-evidence-review-v2
npm run test:run -- src/ingestion/elections/connecticut-primary-evidence-review-package-v2.test.ts
npm run data:verify
```

The focused adversarial suite fully rehashes attempted nomination, result, elected-declaration, statutory-trigger, statutory-conclusion, approval, scoring, publication, and unknown-field escalations and requires every mutation to be rejected.
