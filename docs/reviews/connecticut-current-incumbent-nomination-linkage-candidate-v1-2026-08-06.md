# Connecticut current-incumbent nomination linkage candidate v1 — 2026-08-06

## Outcome

This reviewer-only candidate links all ten retained Connecticut Democratic U.S. House endorsement-form observations—districts 1–5 in 2022 and 2024—to the five current target identities in the August 2026 roster, House Clerk MemberData, and Congress Legislators snapshot.

Eight cycle observations are exact normalized same-district name matches. The two CT-04 observations are narrowly derived links from endorsement name `Jim Himes` to Clerk official name `James A. Himes`; the Congress snapshot independently retains `Jim` as the nickname for Bioguide `H001047`. This is one unique derived person relationship represented in two cycle observations.

The relationship means only that the endorsement-form name matches the current target identity. It does not assert that the current member was incumbent at the historical election, was lawfully nominated, appeared on the final ballot, won a primary, or was certified. All nomination and result statuses remain null. Every row is unselected, identity-unapproved, geography-unapproved, score-ineligible, reviewer-only, and publication-ineligible.

## Closure and integrity

The five direct parents are the current target roster, unresolved primary source-selection proposal, House Clerk XML, Congress Legislators current snapshot, and Connecticut nomination-authority receipt. The artifact contains five targets and ten observations: eight exact, two derived, ten proposed links, zero direct identifier bridges, zero nomination/result conclusions, zero automatic approvals, zero selected rows, and zero score-eligible rows.

- Artifact: 21,758 bytes; SHA-256 `e4b461a364a31dae528d4099022f9417110c1aa5430c53b2076b7c09c5981644`
- Observation set: `2de0d07792013a1f1906e581146d18b295d758f6e6e4fe4a7eb426a908b63563`
- Package: `31edb710517a8cac9008750c18dae9fb7beccb9b2655a9f5662b6fbf3e4cc863`

```bash
npm run generate:ct-nomination-identity
npx vitest run src/ingestion/elections/connecticut-current-incumbent-nomination-linkage-candidate.test.ts
npm run data:verify
```

The next step is a separate historical-geography candidate using the retained CT CD118/CD119 inventories and Census plan-change authority. Final Democratic candidacy/ballot closure, statutory cancellation status, general-election nominee cross-check, progressive classification, human review, and publication approval remain unresolved.
