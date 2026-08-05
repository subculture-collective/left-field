# AIPAC numeric review package v3 — 2026-08-05

## Outcome

The concise reviewer queue now contains five decisions, reduced from numeric review package v2's ten. Five incumbent cases were resolved automatically from locked evidence and are not presented as human decisions. CA-31/2024 remains the sole evidence-specific conflict. No reviewer approval was inferred from any automatic disposition.

| Decision class | Count | Recommended safe default |
|---|---:|---|
| CA-31/2024 source precedence | 1 | Exclude only the affected relationship pending a cutoff-bounded terminal Form 2 amendment-chain receipt |
| Numeric lineage and receipt methodology | 1 | Retain the exact reviewer-only v3 method |
| Labeled UDP inference policy | 1 | Retain explicit inference labels and provenance |
| Formula-v0.1 score contract | 1 | Retain the explicit 60/25/15 AIPAC-route weights and keep current-cycle not-applicable cases AIPAC-score-ineligible pending a separately versioned methodology |
| Publication promotion | 1 | Defer and keep all artifacts out of the public release |

## Sole mapping decision

Stable ID: `aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174`

Question: should the 2024 CA-31 relationship use `C00850420` when CN24 names stale committee `C00650648`, CCL24 supplies no relationship, and the retained direct Form 2 evidence has no cutoff-bounded terminal-amendment-chain receipt?

Recommendation: defer only the 2024 relationship until the missing terminal-chain receipt establishes which filing controlled at the cutoff. Retain the independently exact 2026 relationship. The reversible default is `exclude_only_ca31_2024_relationship`.

Required evidence: `cutoff_bounded_terminal_form2_amendment_chain_receipt`.

The package preserves the exact official filing lock IDs, source-resolution hash, decision hash, evidence consequences, and `high_but_insufficiently_closed` confidence. Resolution, reviewer, and review timestamp remain null.

## Methodology and promotion decisions

The three methodology decisions are intentionally separate:

1. Accept or correct the cycle-scoped cutoff-ledger, terminal-revision, signed-net, relationship-disposition, and transaction-receipt method.
2. Accept or reject the 16 usable UDP challenger relationships as explicitly labeled inferences rather than direct observations.
3. Accept formula v0.1's explicit AIPAC-route weights—60% AIPAC support, 25% blue baseline, and 15% primary feasibility—and its six-cell denominator for this candidate, or require a separately versioned formula and sensitivity analysis before changing either weights or not-applicable handling.

The promotion decision remains independent. Its recommendation is to defer until CA-31 precedence and all three methodology decisions are explicitly resolved, then generate a distinct approved release rather than modifying any proposal.

## Reproduction

```bash
npm run generate:aipac-numeric-review-v3
npm run test:run -- src/ingestion/fec/aipac-numeric-review-package-v3.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/aipac-numeric-review-package-v3.json`

- Artifact SHA-256: `8e47d8ac88e66bf91bf22ee4259aef09c612b7786dece147d494741801e54b8d`
- Decision-set SHA-256: `f3b871698cb9379759e97cd1c51923d6a9268c94fd2f10259f310d52db239108`
- Package SHA-256: `59a3f3c08d247a01996a5710ea5f461e344591c71dd4338533c4329d5dbf62ad`
- Status: `proposed`
- Reviewer: null
- Publication eligible: false

The package contains no donor names, addresses, employers, occupations, filing free text, reviewer identity, signature, approval timestamp, promotion action, or public deployment claim.
