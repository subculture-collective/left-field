# South Carolina House primary results v3 — 2026-08-09

The South Carolina Election Commission’s results index links event `126294` as the June 9, 2026 statewide primary. The retained ENR version is `375593`; its published summary contains the Democratic SC-06 contest and its settings explicitly report `chkisfinalupload: false` and `chkiscanvasupload: false`.

The SC-06 result is James E Jim Clyburn 75,411 and Frederick R Goodwin 8,145, totaling 83,556. The source marks Clyburn, but this package does not resolve winner identity, candidate identity, certification, or score eligibility.

| Retained item | Bytes | SHA-256 |
|---|---:|---|
| Commission results index | 92,673 | `07a501b922471b08e3d8fc6efc77f8833c2560af683c02dde8370ca7f06de6fd` |
| ENR current version | 6 | `915d43ab9af60fd2a8527e125f88e295dd9b3abeca79b412bca6886279ad6e7d` |
| ENR config | 82 | `78292ed41040455b998725bdda012ab0b0bd438c27d902795578de956bd7603d` |
| ENR election settings | 38,288 | `93589dca72cffcad00a3a863c850180da8885e20d7d1ee9c44015f6a5e9ec81e` |
| ENR summary | 51,532 | `f7e6c57ae8c7eccb002dc0da5fba30b7748b38aee7e36d424feee3d951ee038b` |
| South Carolina v3 package | 3,159 | `bf179a5e100477ebca0018f5c6f9a49476a392a16d05012076d87894243e2452` |
| Nationwide projection v21 | 63,989 | `10b1c1dc30f806297cf8f835b80df95a2b61a0517729cf0f0c32132f8497370e` |
| Coverage ledger v21 | 20,309 | `d9ec213b80bddd5b48834924f95ea93b31acec2bcaae9453fb3a673f10f8867f` |

Projection v21 contains 39 reported contests and four source-absence observations across 78 target district-cycle observations. All 43 processed observations remain outside the active Priority Index.

## Reproduction

```sh
npm run acquire:rapid-house-primary-south-carolina-2026
npm run generate:rapid-house-primary-south-carolina-results-v3
npm run generate:rapid-house-primary-projection-v21
npx vitest run src/rapid-acquisition/house-primary-south-carolina-results-v3.test.ts src/rapid-acquisition/house-primary-projection-v21.test.ts src/ui/rapid-house-primary-coverage.test.ts
npm run typecheck
npm run data:verify
```
