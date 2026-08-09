# Rapid Mississippi House-primary results v3 — 2026-08-09

## Outcome

The rapid House-primary lane now retains the Mississippi Secretary of State's official statewide Democratic recapitulation for the March 10, 2026 federal primary. The target projection closes MS-02 as a reported three-candidate contest with 74,500 votes:

- Bennie G. Thompson — 64,334
- Evan Littleton Turnage — 9,249
- Pertis Herman Williams III — 917

The source contains no parsed winner marker. Candidate identity remains null and the observation is not score eligible.

## Retained evidence

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Official statewide Democratic recap PDF | 81,754 | `270b461a23890b7b593146fc10055e3d75e91057ebd4614e17a4064fd94444c4` |
| Deterministic `pdftotext -layout` extract | 36,990 | `0af2ea5090bbc15862d144e0cb08da5d4d034c383b45329534b3ab54f4d72e87` |
| Mississippi v3 result package | 3,064 | `1d754ec34676e3fd33637de7298bc38acc6ccf51683750d20966bf877673d75e` |
| Nationwide primary projection v18 | 63,269 | `ad2de9fc0d98dd2b63bcaae6a08359b1ca6024130da46909c83dbf21e89d1c8f` |
| Coverage ledger v18 | 20,170 | `86bf36cd92b71d01edaeab15c1147661bd0367632bdd3a3f5fcbe39e66f94039` |

The result package has package SHA-256 `04272c72cd8d51941512aef6ca60ca1f50fca485f5731115ac8972af5fdbc19e` and result-set SHA-256 `acf54bbdd0074ff0920d9cc5510e4aaefaea98466d46186e0d9a3773ceb53baa`.

## Boundary

This closes a source observation, not an incumbent identity or score input. The projection does not infer a winner from vote rank, does not claim a separate candidate-level certification instrument, and does not change the Priority Index.

## Reproduction

```bash
npm run generate:rapid-house-primary-mississippi-results-v3
npm run generate:rapid-house-primary-projection-v18
npx vitest run src/rapid-acquisition/house-primary-mississippi-results-v3.test.ts src/rapid-acquisition/house-primary-projection-v18.test.ts src/ui/rapid-house-primary-coverage.test.ts
npm run typecheck
npm run data:verify
```
