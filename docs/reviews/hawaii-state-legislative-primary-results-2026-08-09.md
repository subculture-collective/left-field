# Hawaii state-legislative primary context — 2026-08-09

## Outcome

The rapid factual lane now retains 243 candidate-bearing Democratic or Republican Hawaii state House and Senate primary contests from the official 2022 and 2024 statewide summary files. The projection contains 352 candidate rows and 807,154 candidate votes:

- 2022: 137 party contests, 205 candidate rows, and 511,495 votes.
- 2024: 106 party contests, 147 candidate rows, and 295,659 votes.
- Combined: 67 state Senate contests, 176 state House contests, 136 Democratic contests, and 107 Republican contests.

The source files are the already-retained Hawaii Office of Elections UTF-16LE `Format#1` summaries (`hi-2022-primary-summary` and `hi-2024-primary-summary`). Each candidate's mail and in-person channels reconcile exactly to its reported total. Repeated contest metadata, candidate identifiers, precinct fields, blank votes, overvotes, and invalid votes are preserved and checked.

## Boundaries

The artifact represents only candidate-bearing party contests reported by the source. It creates no row for an absent office or party contest and makes no no-primary, uncontested, zero-vote, winner, certification, identity, ideological, or score inference. The 2022 source's counted-precinct values are retained verbatim rather than recast as a finality claim. Every contest has `formulaEligible: false`, `winnerIdentity: null`, and `identity: null`.

## Reproduction

```bash
npm run generate:rapid-hawaii-state-legislative
npx vitest run src/rapid-acquisition/hawaii-state-legislative-results.test.ts
npm run typecheck
npm run data:verify
```

Generated artifact:

- Path: `data/metadata/rapid-hawaii-state-legislative-primary-results-v1.json`
- Bytes: `339653`
- SHA-256: `ca9c67169e29abe6852ec4cc8dc287641643a76ec1a4b4459c4348a9aad1bf4b`
- Contest-set SHA-256: `c24a389854b5b1ca1ff5c36c5f33a9ba090efbf9cca5bfd7b5a7bca1c58021c7`
- Package SHA-256: `962979034dc9e4f7814f7cf406b77ab5087a3b8ca91326b58ce0a8db9d45260b`

