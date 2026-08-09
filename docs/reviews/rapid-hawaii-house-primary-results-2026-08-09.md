# Hawaii 2026 rapid House-primary result receipt

The Hawaii Office of Elections now publishes the August 8, 2026 statewide primary summary. This receipt retains that exact 31,544-byte snapshot at SHA-256 `d21d1c0e7932cc105c78a3949bbc3387222d8193d37cc8f4faba16e57746e100` and parses only the Democratic U.S. House rows.

The resulting immutable evidence object closes two contests and nine candidate rows: HI-01 has 98,078 candidate votes and HI-02 has 87,508. The v23 national rapid-primary projection consequently contains 42 reported contests, four explicit source absences, 114 candidate rows, and 2,708,176 retained candidate votes across 78 target observations.

This is an official election-result snapshot, not a separately certified canvass claim. The source winner remains unmarked; candidate identity, historical geography, evaluator inputs, and score eligibility remain null or false. The active House Priority Index is unchanged.

Pinned outputs:

- Hawaii result package: 2,585 bytes; SHA-256 `7b9370bee604f6e04a3bb68e26975f955316cc939e6513b73bae33a53181c8fc`; package `c27685c96e6acd7cdb535e76900746ba855b807ac502b3e1bb80af9498fbe7b5`.
- Rapid projection v23: 64,296 bytes; SHA-256 `4f07457c217fa99eca310ec883937328a9dfa1f060b95d95dbcf2ae7b228d38d`; package `bb384fefae0fc22a2cb8027cd1b7515187213adb493b801d8862c1e24fbb6355`.
- Coverage ledger v23: 20,217 bytes; SHA-256 `870cf88858c5986d51ceb5291658c6c23c01ecb8a8e59979e273b34a862cb780`.

Reproduction:

```sh
npm run acquire:rapid-house-primary-hawaii-2026
npm run generate:rapid-house-primary-hawaii-results-2026
npm run generate:rapid-house-primary-projection-v23
npx vitest run src/rapid-acquisition/house-primary-hawaii-results-2026.test.ts src/rapid-acquisition/house-primary-projection-v23.test.ts src/ui/rapid-house-primary-coverage.test.ts
```
