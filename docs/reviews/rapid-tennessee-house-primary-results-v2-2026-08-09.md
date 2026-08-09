# Rapid Tennessee House primary results v2

This slice extends the retained Tennessee House-primary observation through the August 6, 2026 election. It retains the Tennessee Secretary of State Election Night Reporting congressional page as an exact 70,586-byte snapshot (`3bc6693f8f732a120ceb0c1e5cf947dfaa601b6fb8099a930a9c1245406cc9ea`). The page identifies itself as `August 6th, 2026 Unofficial Election Results`, labels each congressional race `Final Unofficial Results`, and says county election commissions submit the results to the Tennessee Coordinator of Elections.

The parser closes all nine Democratic U.S. House primary arrays before projecting the current-target coordinate. TN-09 contains Justin J. Pearson 32,092; London Lamar 11,870; M. LaTroy A-Williams 3,318; and Jim Torino 1,531, for 48,811 votes. Across 2022, 2024, and 2026, the Tennessee target projection now contains three reported contests, 11 candidate rows, and 160,076 votes.

The retained page does not expose a parsed winner marker and is not a certification instrument. The result therefore remains `not_marked_by_source`, final-unofficial, and unscored. Tennessee's 2026 congressional redraw also prevents this district-number observation from becoming an incumbent identity or historic-geography link. No winner, nominee, identity, geography approval, or score value is inferred.

Generated artifacts:

- `rapid-house-primary-tennessee-results-v2.json`: 3,234 bytes; SHA-256 `a5292df58fc0647abaae13e55e44aecf56c96ec606ab6a6a327582db4fd15e00`; package `523dcde249b8c4fc0d1b366c8d6418780135a632e3cfb159289a3a365cc7edd4`.
- `rapid-house-primary-projection-v22.json`: 64,074 bytes; SHA-256 `d9894597b4c7b4bc8f3adb716974bac4af5f098838442f9ef3eada659d9e8ed6`; package `d55e6ced2e8e4c27ba02807d1b4e1f01151d2a3cff10904ff28e5c9988dd8622`.
- `rapid-house-primary-coverage-ledger-v22.json`: 20,266 bytes; SHA-256 `40200f001b359da0a91018492e146e5850fada046bbf21b716ae2d68419cc58b`.

Reproduction:

```sh
npm run acquire:rapid-house-primary-tennessee-2026
npm run generate:rapid-house-primary-tennessee-results-v2
npm run generate:rapid-house-primary-projection-v22
npx vitest run src/rapid-acquisition/house-primary-tennessee-results-v2.test.ts src/rapid-acquisition/house-primary-projection-v22.test.ts src/ui/rapid-house-primary-coverage.test.ts
npm run typecheck
npm run lint
npm run data:verify
```
