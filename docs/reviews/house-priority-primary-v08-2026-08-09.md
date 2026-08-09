# House Priority Index v0.8 primary-evidence activation — 2026-08-09

## Outcome

V0.8 activates direct 2024 Democratic-primary evidence for 21 of 430 ranked seats. It replaces the prior inferred primary-feasibility component; it does not add another weight. Twenty scores change and 410 reproduce v0.7 exactly. No qualifying route changes and no Democratic movement exceeds 13 points.

## Evidence closure

- 22 retained 2024 target-contest observations were reviewed.
- 19 current-incumbent links use exact normalized House names.
- 2 use bounded retained relationships: `Emanuel Cleaver, II` to House `Emanuel Cleaver` with Congress suffix `II`, and `Gwen S. Moore` to House `Gwen Moore` using the same first name, last name, district, and source middle initial.
- RI-01 remains unresolved. The result names `Gabriel Amo*`; retained House and Congress identity files name `Gabe Amo` and contain no direct bridge between those given-name forms.
- The 21 eligible contests contain 1,141,209 linked incumbent votes and 1,320,426 total contest votes.
- Every eligible row is a 2024 contest joined to the same CD119 district key. No historical same-number inference or crosswalk is used.

## Calculation

For an admitted row:

`primary feasibility = 100 - (incumbent votes / contest votes * 100)`

The result replaces the previous primary component in the existing structural route:

- Deep blue: `0.70 * blue baseline + 0.30 * direct primary feasibility`
- AIPAC-supported blue: `0.60 * AIPAC + 0.25 * blue baseline + 0.15 * direct primary feasibility`
- Where existing exact local context is present: `0.80 * recomputed structural baseline + 0.20 * local context`
- Final Democratic score: `0.65 * structural + 0.20 * alignment + 0.15 * cash vulnerability`; unavailable cash is omitted and the available 0.85 weight is renormalized.

Source winner markers are preserved in the evidence artifact but never used to identify the incumbent, infer a nomination, or calculate the metric.

## Immutable outputs

- `rapid-house-primary-2024-incumbent-evidence-v1`: 24,686 bytes; SHA-256 `9a264ecc89b3c07581d523a7c6fc5af02f150bb90cac08cf0cbcaa8727f3c8d5`; row set `223db58efed35118e45580c7bb1d1247f065a822a5ee64b993c88e1d8f2439ca`; package `39a7c3d8b27a0a1631c72a1ea66b6b64bb77a5e24a5c515d1ae29992c1e66017`.
- `house-score-v08-active-projection-v1`: 511,918 bytes; SHA-256 `76fcb690ccb7abfff5c8a8b6dca844cee2da688417250192b495c5e127e1328d`; row set `931f080522cc5a383d07402282c259dbaaaf429a6fe09c8399fe3adb578624b1`; package `79b154e4e954d3f8327307e8a977b77e77fc59a311114193be22cff5e0ec913a`.

## Reproduction

```sh
npm run generate:rapid-house-primary-incumbent-evidence
npm run generate:house-score-v08-active
npx vitest run src/rapid-acquisition/house-primary-incumbent-evidence.test.ts src/rapid-acquisition/house-score-v08-active.test.ts src/ui/rapid-expansion-status.test.ts src/lib/house-priority-index.test.ts
npm run typecheck
npm run data:verify
npm run lint
```
