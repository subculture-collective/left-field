# Rapid Kentucky House-primary results v3 — 2026-08-09

## Outcome

The rapid House-primary lane now retains Kentucky's official May 19, 2026 certification of vote totals. Within the complete U.S. House section, the document enumerates Republican and Democratic party tables by district. It contains a KY-03 Republican table and then proceeds to KY-04 without a KY-03 Democratic table.

The KY-03 Democratic target observation is therefore recorded as `source_absent_no_disposition_inference`. Candidate count, votes, winner, nomination, incumbent identity, and result authority remain null. The observation is not score eligible.

## Retained evidence

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Official 2026 certification PDF | 221,811 | `e69458bae9bcce14f4aa22b3394ff0d47f9c5c9f8bd2915be1650519fdd8cd9c` |
| Deterministic `pdftotext -layout` extract | 96,612 | `b0fc0f90ac2837238c5bbb8a535c0e0e04a879accd99035852fb4145549c5232` |
| Kentucky v3 result package | 2,870 | `23ab4ca7e96b91956c036913499f6481bc8c5f555e5ad287a6f95adad0b2788a` |
| Nationwide primary projection v19 | 63,560 | `f110271554d81a6d7b6c6f642aa29b39b3aff8302019011e3f62048af0930f9b` |
| Coverage ledger v19 | 20,317 | `4bd9df172a66fb3f91f2aa631757e284fec706f70034dafe2c43cc0585742385` |

The result package has package SHA-256 `68401535ae98878db5f734dac3ef0a0995452dc643773b2813f9ea0d8e6a07ce` and result-set SHA-256 `b2cd081baf929f40a4d20f3b8f37f9b757e7c9a84ad64382f96a7cfb12ba39fb`.

## Boundary

Absence from the retained complete source does not prove that no primary occurred, that the incumbent was uncontested or nominated, or that votes were zero. This slice supplies no person identity and makes no Priority Index change.

## Reproduction

```bash
npm run acquire:rapid-house-primary-kentucky-2026
npm run generate:rapid-house-primary-kentucky-results-v3
npm run generate:rapid-house-primary-projection-v19
npx vitest run src/rapid-acquisition/house-primary-kentucky-results-v3.test.ts src/rapid-acquisition/house-primary-projection-v19.test.ts src/ui/rapid-house-primary-coverage.test.ts
npm run typecheck
npm run data:verify
```
