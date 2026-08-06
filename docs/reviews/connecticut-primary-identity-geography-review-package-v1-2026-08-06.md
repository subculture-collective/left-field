# Connecticut primary identity/geography review package v1 — 2026-08-06

Status: proposed reviewer queue; not approved, evaluator-eligible, score-bearing, published, or deployed.

## Review matrix

The package joins all ten Connecticut endorsement/current-identity observations one-to-one with their historical-geography candidates. Eight identity observations are exact-name relationships; the two CT-04 cycle observations retain the bounded `Jim Himes` to `James A. Himes` derived relationship. Five 2022 rows retain CD118-to-CD119 continuity candidates and five 2024 rows retain exact CD119 session/key candidates.

Every record remains pending nomination closure. Nomination and result statuses are null throughout. Zero records are identity-approved, geography-approved, jointly approved, selected, evaluator-eligible, score-eligible, publication-eligible, or deployed.

## Five independent proposed decisions

1. Accept the ten current-identity relationships while preserving no historical-incumbency, nomination, or result inference.
2. Accept the ten geography relationships without claiming raw geometry equality, overlap, or population equivalence.
3. Retain endorsement evidence while nomination, result, and certification remain unasserted.
4. Retain no-disposition and no-selection treatment until candidacy, cancellation, and nominee authority are reviewed.
5. Retain progressive-classification exclusion because no complete candidate universe or reviewed contest-effective classification is present.

Each decision binds the same ten records, blocks only affected publication, does not block other work, and has a null reviewer resolution. Resolving one decision does not resolve another or mutate either parent candidate.

## Integrity

The exact three direct parents are the unresolved source-selection proposal, Connecticut identity candidate, and Connecticut geography candidate. Their receipt, Clerk, Congress, Census, and TIGER inputs remain indirect hash-validated lineage.

- Artifact: 22,928 bytes; SHA-256 `3865508fcce8b0712854f10d8831ab8608499ba692e48f0575d36b0eb2d15d1f`
- Review-record set: `c88eede71b533a6a07945d56eb592c4d0d7f4afba59dcb2761760982be7fb9e9`
- Decision set: `35d23ea2c7002e6215df29ccd36ea71833d302d65bbf6446f815138403c1f8e1`
- Package: `093d6c3b95f6e4364d183c4c036dead44867cb52a4a417e2297df5f847c0954b`

```bash
npm run generate:ct-primary-joint-review
npm run test:run -- src/ingestion/elections/connecticut-primary-identity-geography-review-package.test.ts
npm run data:verify
```
