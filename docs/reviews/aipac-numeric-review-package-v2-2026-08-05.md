# AIPAC numeric review package v2 — 2026-08-05

## Outcome

The current reviewer queue contains ten decisions, reduced from the historical v1 package's twelve. The `H0IL07167` CA-47/IL-07 ambiguity is no longer presented for human resolution because foundation v2 records two separate automatic dispositions: one accepted independently supported Illinois relationship and one rejected invalid California origin. No reviewer approval was inferred from either disposition.

| Decision class | Count | Safe default |
|---|---:|---|
| Evidence-specific incumbent resolutions | 6 | Keep the affected seat blocked and exclude its proposed relationship |
| Numeric lineage, inferred-relationship, and scoring-model methodology | 3 | Retain as reviewer-only candidate data |
| Publication promotion | 1 | Defer until all prerequisites are explicitly decided |

The six mapping decisions cover CA-31, MA-06, MD-04, MN-03, NH-01, and NY-04. Each is bound to the exact resolution-candidate and decision hashes. The package contains no names, addresses, employers, occupations, free text from filings, reviewer identity, signature, approval timestamp, or promotion claim.

The three methodology decisions ask whether to accept:

1. the cutoff-ledger, terminal-revision, signed-net, relationship-resolution, and transaction-receipt method;
2. the 16 usable UDP challenger relationships as explicitly labeled inferences with their provenance intact; and
3. formula v0.1's 60% AIPAC-route weighting as a versioned initial reviewer model.

The promotion decision is intentionally separate. Its recommendation is to defer, resolve the six mappings and three methodology choices, and then generate a distinct approved release rather than mutating any proposal.

## Reproduction

```bash
npm run generate:aipac-numeric-review-v2
npm run test:run -- src/ingestion/fec/aipac-numeric-review-package-v2.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/aipac-numeric-review-package-v2.json`

- Artifact SHA-256: `c16213bdb03156091d75b95bc37f156cb845232d6473094852c3580405efc81b`
- Decision-set SHA-256: `3d2c3733bf9a9b5ea725f095b0add09b2614e7470e71988e8a50b53c221b322f`
- Package SHA-256: `408780bf094982c95b48549593efd1c3ed2e8f894449c61d47fd989204681d52`
- Status: `proposed`
- Reviewer: null
- Publication eligible: false
