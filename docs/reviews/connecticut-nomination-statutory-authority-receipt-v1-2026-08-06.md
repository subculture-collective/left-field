# Connecticut nomination statutory-authority receipt v1

Date: 2026-08-06
Status: proposed reviewer evidence; not approved; not publication eligible

## Outcome

The retained receipt binds the existing privacy-filtered Connecticut endorsement observations to the cycle-specific official statutory instruments that govern nomination and primary-cancellation consequences. It does not conclude that any observed endorsed candidate became the nominee, that no primary was required, or that a primary was cancelled.

Artifact: [`data/metadata/connecticut-nomination-statutory-authority-receipt-v1.json`](../../data/metadata/connecticut-nomination-statutory-authority-receipt-v1.json)

- Bytes: `7159`
- SHA-256: `6c8ea07744001b26f2597b6c00b10e3d05e3329e459726b7beb4bf159575d089`
- Package SHA-256: `0359093fa128ec5829095be0c86024d68b700c4dad9e3648b67df3587adee5f6`
- Cycle-set SHA-256: `61029ccf7a0c91ecaf8451432ebb93b14eb1b1c34713ff52f5a9e3229634ba74`

## Cycle-specific authority

| Cycle | Sections 9-400, 9-415, 9-416 | Sections 9-426, 9-429 | Cancellation timing represented |
| --- | --- | --- | --- |
| 2022 | 2021 Chapter 153 publication | 2021 Chapter 153 publication; the 2022 supplement does not amend any reviewed section | Prior to opening of the polls |
| 2024 | 2023 Chapter 153 publication | 2024 supplement amendments, effective January 1, 2024 | Before commencement of early voting for the relevant office-primary provisions |

The receipt describes the statutes as conditional rules. Sections 9-400 and 9-415 define qualifying candidacy and primary-trigger mechanics; section 9-416 requires both an unmet convention-threshold condition and absence of a timely conforming non-endorsed filing before its no-primary consequence applies. Sections 9-426 and 9-429 require additional death, withdrawal, disqualification, replacement, attrition, and timing facts. None of those trigger facts is established by the retained endorsement observations or the zero-row 2024 statewide candidate-list observation.

## Locked lineage

The direct parents are exactly:

1. `ct-2021-chapter-153`
2. `ct-2022-chapter-153-supplement`
3. `ct-2023-chapter-153`
4. `ct-2024-chapter-153-supplement`
5. `connecticut-primary-nomination-authority-receipt-v1`

The output remains `reviewerOnly: true`, `publicationEligible: false`, and `review.status: proposed`. Both cycle rows retain null trigger facts, null primary-cancellation status, null nomination conclusion, `approved: false`, and `scoreEligible: false`.

## Reproduction and validation

```bash
npm run generate:ct-nomination-statutory-authority-v1
npm run test:run -- src/ingestion/elections/connecticut-nomination-statutory-authority-receipt.test.ts
npm run data:verify
```

The focused adversarial suite rebuilds hashes after attempted nominee, no-primary, trigger-fact, timing, and approval substitutions and requires every mutation to be rejected.
