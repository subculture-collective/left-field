# Connecticut general-election cross-check receipt v1 — 2026-08-06

This reviewer-only receipt retains ten official party-labeled Democratic U.S. House general-election appearances from Connecticut's 2022 and 2024 Statements of Vote. The exact Democratic-column totals are 712,823 votes in 2022 and 981,919 in 2024.

| Cycle | District rows | Democratic appearances | Democratic-column votes | Exact-scope elected declarations |
|---|---:|---:|---:|---:|
| 2022 | 5 | 5 | 712,823 | 0 — not present in the retained instrument |
| 2024 | 5 | 5 | 981,919 | 5 — declared elected to the 119th Congress |

The rows name John B. Larson, Joe Courtney, Rosa L. DeLauro, Jim Himes, and Jahana Hayes for districts 1–5 in each cycle. Every observation remains proposed, unapproved, score-ineligible, and excluded from evaluator use.

General-election party appearance is a strong nominee cross-check but does not independently establish which primary nomination mechanism applied. The receipt therefore keeps `primaryNominationStatus` null for all ten rows. It does not project the 2024 Board of Canvassers declaration onto 2022, and `not_present_in_retained_instrument` is not converted into a negative elected claim.

- Artifact: 10,581 bytes; SHA-256 `70e40dbad3ec17a4d7e8998e37c98033768450c8722f70e16ca3c1754ca6d3e1`
- Row set: `7551d497051ed040a41cdb5d7d7a886de02597a0da2e6c4958e35a0640cd3dda`
- Package: `abe14776b5a5ff38a8a5fcc3d6cd5714d72a40d7ab2b338fe5912465fee9a2bc`

```bash
npm run generate:ct-general-crosscheck
npm run test:run -- src/ingestion/elections/connecticut-general-election-crosscheck-receipt.test.ts
npm run data:verify
```

The complete final Democratic primary candidacy/ballot universe and source-locked statutory nomination/cancellation authority remain separate open gates. No reviewer decision, promotion, publication, or deployment is implied.
