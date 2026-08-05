# North Carolina current-incumbent primary linkage candidate v1

Status: **proposed reviewer-only identity evidence; not approved, published, or evaluator-eligible**

The candidate closes the exact 12-observation universe formed by four current Democratic North Carolina target seats—districts 1, 2, 4, and 12—across the 2022, 2024, and 2026 primary cycles. It binds the production target roster, official House Clerk identities, retained congress-legislators aliases, the North Carolina primary receipt, and the still-unresolved 2022 archive-versus-canvass decision package.

Six target district-cycles contain reported contests. Four candidate names exactly match the normalized official House name. Two are explicitly derived, high-confidence relationships: source `Don Davis` to official `Donald G. Davis`, and source `Alma Shealey Adams` to official `Alma S. Adams`. The primary archive supplies no direct person identifier, so all six remain proposed rather than approved.

The other six district-cycles are the receipt's explicit `unresolved_no_reported_contest_in_complete_archive` blocks: NC-02/2022; NC-01, NC-04, and NC-12/2024; and NC-01 and NC-02/2026. They are not converted into zero, uncontested, no-primary, or incumbent links.

None of the six reported target rows is among the four 2022 archive-versus-canvass conflicts in NC-03 and NC-11. The identity candidate nevertheless binds that unresolved decision and labels all 2022 observations as an unaffected scope within a parent cycle that still contains an unrelated conflict.

North Carolina is separately subject to historical-boundary review. Every row remains identity-unapproved, geography-unreviewed, evaluator-excluded, score-ineligible, reviewer-only, and publication-ineligible.

Reproduce and verify with:

```sh
npm run generate:nc-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/north-carolina-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
```
