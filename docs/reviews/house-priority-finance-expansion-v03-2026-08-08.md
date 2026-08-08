# House Priority Index finance expansion v0.3 — 2026-08-08

The public House Priority Index now uses the latest incumbent campaign-finance aggregate already published in `rel_full_20260804_v2`. This expands finance context from the original 212 Democratic target briefs to the full 430-seat Democratic and Republican index.

## Coverage

- 430 occupied regular Democratic or Republican voting House seats.
- 427 cash-on-hand values: 210 Democratic and 217 Republican.
- Three explicit `not_reported` outcomes: MD-04, NY-04, and TX-03.
- Receipts and disbursements are retained and displayed but do not independently affect rank.
- Projection artifact: `data/metadata/house-priority-finance-20260808-v1.json`.
- File SHA-256: `a908273c32fe63e53d4820810a8912bbb216486c1e83e00130c540ddbd18bf51`.
- Projection SHA-256: `cf00b2bcfaf0ffb29f29f2b6f240f597c7a3c38e23ed5882b4d64d10b6940d66`.

## Cash-vulnerability scale

Cash is transformed with an inverse log scale:

```text
100                                 cash <= $50,000
100 * (1 - log(cash / 50,000) /
             log(5,000,000 / 50,000)) otherwise
0                                   cash >= $5,000,000
```

This makes cash differences meaningful across several orders of magnitude without allowing a single very large committee balance to dominate the entire index. Higher means the incumbent appears more financially vulnerable. It is not a measurement of challenger strength, donor quality, burn rate, or likely spending.

## Formula changes

Democratic-held seats:

```text
priority = 0.65 * selected structural baseline
         + 0.20 * incumbent alignment gap
         + 0.15 * cash vulnerability
```

Republican-held seats:

```text
route    = 0.75 * general-election competitiveness
         + 0.25 * cash vulnerability
priority = 0.70 * route
```

The Republican route remains capped, now at 70. It still receives no invented Democratic-primary, AIPAC, or Democratic-alignment value. When cash is missing, the available weights are renormalized rather than replacing the missing observation with zero.

## Reproduction and checks

The export is read-only and runs against the published release database:

```bash
npm run export:house-priority-finance
npm test -- --run src/lib/house-priority-index.test.ts src/ui/view-models.test.ts
npm run typecheck
npm run build
```
