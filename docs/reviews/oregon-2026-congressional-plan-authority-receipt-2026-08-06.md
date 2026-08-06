# Oregon 2026 congressional plan authority receipt v1

Date: 2026-08-06

Status: source-only evidence receipt; reviewer-only, unapproved, score-ineligible, publication-ineligible

## Outcome

This receipt retains a narrow official authority chain for Oregon's current congressional layer:

- the current Oregon Legislature redistricting page identifies SB 881 A as the adopted congressional plan, signed into law and upheld by the courts;
- enrolled SB 881 A creates six congressional districts and records passage on September 27, 2021;
- the current LPRO interactive-map data guide says the congressional layer is based on the redistricting plans adopted September 27, 2021; and
- a deterministic Oregon extract from the retained Census CD119 national block-equivalency bundle contains 130,807 unique blocks across districts 01–06.

The district block counts are 15,034; 50,388; 12,862; 24,209; 16,434; and 11,880 for districts 01 through 06 respectively.

## Claim boundary

The supported conclusion is limited to the current official LPRO layer being based on the adopted 2021 plan. The Census extract is recorded separately as a complete CD119 inventory; no exact source-plan-to-CD119 block concordance was assessed. The receipt does not claim a Census CD120 product, exact CD120 block membership, raw geometry equality, an overlap threshold, direct Oregon election-administration confirmation for the 2026 election, or legal permanence. The court statement is attributed to the retained current Legislature page; no separate court-docket search is claimed.

This source-only slice creates no geography candidate, reviewer decision, approval, evaluator value, score, publication, or deployment. A later geography-v2 composer may use this receipt while retaining null CD120 historical GEOIDs and all independent review gates.

## Reproduction

```bash
npm run fetch:or-primary-geography-authority
npm run generate:or-2026-congressional-plan-authority
npx vitest run src/ingestion/elections/oregon-2026-congressional-plan-authority.test.ts --maxWorkers=1
npm run data:verify
```

The canonical artifact is `data/metadata/oregon-2026-congressional-plan-authority-receipt-v1.json`: 3,530 bytes, SHA-256 `68091a085eb0e395869dc4284b31d7755d90e8ba4cb26b6b2752473c5484df71`, package SHA-256 `0d4d073597d5f5d267aede9dc882dca4103eb617e3f038a52784bade03f4d718`, and block-assignment-set SHA-256 `0b50d449553586a223d4a8303c06d01087616a8516676721aff3d0ea750f2b8c`.
