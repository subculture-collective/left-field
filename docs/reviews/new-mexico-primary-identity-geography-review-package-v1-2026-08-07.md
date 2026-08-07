# New Mexico primary identity/geography review package v1 — 2026-08-07

## Outcome

This reviewer-only package joins the nine New Mexico current-incumbent identity observations to their nine historical-geography observations and creates five independently reviewable proposed decisions.

- Six 2022/2024 records are `identity_and_geography_candidates`: three official CD118-to-CD119 plan-continuity candidates and three exact CD119 session-and-key candidates.
- Three 2026 records are `identity_candidate_cd120_geography_pending`: the proposed identity remains reviewable, while historical session 120 has a null GEOID, no geography candidate, `authority_pending` evidence, and `none` confidence.
- Identity evidence remains three exact Teresa Leger Fernandez relationships and six derived Melanie Stansbury/Gabriel–Gabe Vasquez relationships. All nine state candidate IDs remain explicitly not Bioguide bridges.

The join approves no parent. Every identity, geography, joint, evaluator, scoring, classification, publication, and deployment gate remains false, excluded, or unresolved.

## Authority and inference boundary

All records preserve `secretary_official_federal_results_export_retained` and `sourceWinnerStatus: not_marked_by_source`. Certification stays cycle-specific:

- 2022: `official_results_archive_retained_no_separate_signed_certificate`
- 2024 and 2026: `state_canvass_certification_announcement_retained_exact_certificate_bytes_not_retained`

Winner, nomination, and result conclusions remain null. Vote rank, 100% share, and a one-candidate contest create no winner or nominee. State-canvass announcements are not represented as exact candidate-by-candidate signed certificate bytes.

Geography key evidence does not claim raw-geometry equality, overlap, or population equivalence. CD119 is not substituted for unavailable CD120 authority.

## Proposed decisions

All five proposed decisions cover all nine records, have null reviewer/reviewed-at/resolution fields, and default to excluding affected records from evaluator and publication:

1. Accept the nine Secretary federal-result observations with their exact cycle-specific certification limitations.
2. Accept six geography candidates while retaining three CD120-authority-pending rows.
3. Accept three exact and six documented derived identity candidates without claiming a direct identifier bridge.
4. Preserve source-winner-unmarked and null winner, nomination, and result conclusions.
5. Preserve the progressive-classification exclusion until separate evidence exists.

Each decision remains independent; accepting one does not resolve another.

## Provenance and pins

The exact ordered direct parents are the House primary source-selection proposal, New Mexico identity candidate, and New Mexico geography candidate. The results receipt, roster, House Clerk XML, Congress Legislators snapshot, Census declaration, and TIGER archives remain transitively bound through those parents.

- artifact bytes: `34840`
- file SHA-256: `d3bb4a9d909c2772a7ccbdd6e78441ff2310fb1cf44a1165c55831502e01830b`
- package SHA-256: `b11ecdc2ad4b02d24bff70f878638fa3b3761a4f449655341afd4815644338d9`
- review-record-set SHA-256: `29033d920d005ec96cf82925b96ff7953a0784edbd60c0db7576341e35183dc3`
- decision-set SHA-256: `afdef5f837f3666d2008f13fc91330c238fdad4df8b401248c8133179aadaf1a`

## Reproduction

```bash
npm run generate:nm-primary-joint-review-v1
npx vitest run src/ingestion/elections/new-mexico-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The generator is create-only and byte-deterministic. The focused suite rejects parent bytes or topology drift and fully rehashed CD120, identity-evidence, direct-identifier, certification, winner, approval, score, publication, classification, reviewer, and unknown-field escalations.
