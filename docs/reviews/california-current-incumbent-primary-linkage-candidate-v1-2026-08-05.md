# California current-incumbent primary linkage candidate v1

Status: **proposed reviewer-only relationship evidence; not identity approval, nomination, advancement, score input, publication, or deployment**

This immutable candidate joins the 42 current California Democratic target seats to their 2022, 2024, and 2026 certified same-district top-two contest observations. It accounts for all 126 target seat-cycle rows without claiming that a state-printed name is an authoritative bridge to a current BioGuide person.

| Evidence class | Rows | Meaning |
| --- | ---: | --- |
| Exact normalized name observation | 92 | The state candidate name equals the official House name after declared Unicode, punctuation, spacing, and suffix normalization. This is not identity approval. |
| Derived relationship | 21 | A retained Congress Current alias or transparent official-name token variation produces one same-district candidate. |
| Inferred relationship | 1 | CA-37 in 2022 uniquely shares the official first name: current `Sydney Kamlager-Dove` and source `Sydney Kamlager`. |
| Historical nonappearance | 12 | No unique current-incumbent candidate appears; no prior officeholder is substituted. |

There are 114 reviewable relationships and zero direct identifier links. The California source supplies no BioGuide, FEC, or equivalent candidate-person identifier; candidate order is not treated as a bridge. All relationships remain unapproved and score-ineligible.

## Name and top-two boundaries

The normalizer performs NFKD decomposition, removes Unicode combining marks, then applies the declared ASCII alphanumeric, suffix, whitespace, and case rules. This makes `Nanette Diaz Barragán` and source `Nanette Diaz Barragan` exact normalized observations in 2022 and 2026 instead of lower-confidence first-name inferences. It does not make any row an approved identity.

All 126 rows preserve:

- `nominationSystem: top_two_open_primary`;
- `partyFieldMeaning: candidate_qualified_party_preference`;
- `sourceWinnerStatus: not_marked_or_derived`;
- `advancementStatus: not_derived`;
- `formulaApplicability: confirmed_incompatible_with_party_primary_metrics`.

The 114 selected source rows happen to carry `DEM` preference, but that is a directly retained preference label—not a Democratic nomination, party endorsement, winner, or advancement result. The 33 selected rows bearing a 2024 source incumbent marker retain that observation without using it as an identity bridge or claim of current officeholding.

Historical geography remains governed by the separate, unapproved California geography candidate. Neither package approves the other. The identity candidate informs the existing unresolved `approve-historic-primary-candidate-identity-resolution-v1` decision and also binds the unresolved nonstandard-primary decision; it creates no new decision.

## Immutable identity and reproduction

- Artifact SHA-256: `3fe6f8d58d31c594410f8261d02b79ef64c0425cf5484be04247b86acc1893d3`
- Package SHA-256: `13949617d14185a6b9ad8edc6ae60a7cd013201adf28695361cafdfcac5ca8c3`
- Link-set SHA-256: `775690d3d994509b1c79f63d41e14107f116fbbb082cda59cb01501fd233f2e1`
- Automatic approvals: `0`
- Score-eligible links: `0`

```sh
npm run generate:ca-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/california-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
npm run typecheck
```

The package binds the exact target roster, source-selection proposal, official House Clerk snapshot, retained Congress Current aliases, and California top-two receipt. It excludes candidate addresses, contact fields, dates of birth, donor records, and raw source text.
