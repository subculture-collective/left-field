# Oregon current-incumbent primary linkage candidate v1

Status: **proposed reviewer-only identity evidence; not approved, published, or evaluator-eligible**

The candidate compares the exact source-locked Oregon primary names for 2022, 2024, and 2026 with the five current Democratic Oregon target-seat identities in the production roster, the official House Clerk member list, and retained congress-legislators aliases. Oregon district 2 is outside this package because it has no current Democratic target row; it is not treated as missing or assigned a fabricated incumbent.

The 15 district-cycle observations contain:

- eight exact Unicode-normalized official House-name observations;
- five high-confidence derived official alias or middle-initial relationships;
- two unresolved predecessor cycles;
- 13 proposed identity links;
- zero direct source-candidate identifier bridges, approvals, evaluator values, or score-eligible rows.

The unresolved rows are Oregon district 3 in 2022, whose source candidates precede current incumbent Maxine Dexter, and Oregon district 5 in 2022, whose source candidates precede current incumbent Janelle S. Bynum. Neither predecessor contest is silently mapped to the current incumbent. Exact or derived names establish review candidates only because the official abstracts do not carry Bioguide or another direct person identifier.

All rows remain historical-geography-unapproved, identity-unapproved, evaluator-excluded, reviewer-only, and publication-ineligible.

```sh
npm run generate:or-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/oregon-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `e9732e4983604a1f4f1660036a8fb8357430c1fcdf9ec5694a93bb7fc65a1061`

Link-set SHA-256: `6828464efe30848b43e864e0f76e6d6eb61c4ee786b87b055de78833469001de`
