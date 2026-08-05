# New York City House Democratic primary certified-result corpus — 2026-08-05

## Status and authority boundary

This reviewer-only candidate retains eight New York City Board of Elections precinct recap CSVs from the certified-result sections for the August 23, 2022, and June 25, 2024 primaries. It adds county-board result authority for six 2022 contests (districts 07, 08, 10, 11, 12, and 13) and two 2024 contests (districts 10 and 14). It publishes nothing, assigns no score, and does not alter the earlier statewide v1 disposition artifact.

The retained recap title identifies each contest as Democratic Representative in Congress. Crossover files aggregate the complete New York City portion of a district; the Kings district 08 and New York district 12 files are single-county recaps. This receipt treats the files as authoritative certified-result recaps for the represented city geography. It does not infer a no-primary or uncontested disposition from contests absent from the NYC result index.

## Exact corpus and reconciliation

- Retained contests: **8** (6 in 2022 and 2 in 2024)
- Ballot candidates: **32**
- Named and unattributable write-in options retained: **883**
- Ballot-candidate votes: **335,866**
- Write-in votes: **2,134**
- Total recorded votes: **338,000**
- Unrecorded ballots: **4,157**
- Total ballots: **342,157**
- Evaluator numeric values and score-eligible contests: **0**
- Contest-set SHA-256: `fc4dc4bbe36e4e1d44369f314e430d9b1e8d7a69b7e598d4966a7adc355d2212`
- Package SHA-256: `4bee26afe8ba815659bd45331aa72963043c78f3f6b61b7f63fdd479165732e3`
- File SHA-256: `69b43917b1fac9b7632ec64ad32cc6abed08d73d7113542f3f4c5ca4ccfcf223`

Every certified-recap option total is summed and reconciled to the recap's recorded-vote total; recorded votes plus unrecorded ballots reconcile exactly to total ballots. The generator rejects source-byte drift, changed certification attestations under fully rehashed source metadata, duplicate contest identities, arithmetic disagreement, and output conflicts with the locked receipt.

## Integration boundary

The immutable statewide v1 disposition matrix still records 26 unresolved district-years because it predates this local-authority package. A future versioned integration can conservatively replace eight of those unresolved rows with locally reported contests. Combined authority would then account for 19 reported contests, 15 explicitly state-certified uncontested entries, and 18 unresolved district-years (7 in 2022 and 11 in 2024). Those combined counts are a proposed v2 derivation, not a mutation or publication claim.

District 01 and district 04 in both cycles, plus districts 05 through 09 and 14 through 15 where not directly supported by this package, remain unresolved. Suffolk's current candidate-list evidence and unavailable archived result bytes are not substituted for a certified numeric result; Nassau's current results page is not an archival source for these cycles.

Before evaluator use, the remaining gates are authoritative completion of the contest/disposition universe, current-incumbent candidate identity, compatible historical geography, contest-effective progressive classification, human data review, and explicit publication approval.

## Reproduction

```bash
npm run fetch:nyc-house-primary-certified-results
npm run generate:nyc-house-primary-certified-results
npx vitest run src/ingestion/elections/new-york-city-house-democratic-primary-certified-results-receipt.test.ts
npm run typecheck
npm run data:verify
```
