# North Carolina primary official-source receipt — 2026-08-05

Status: retained official source material; no identity, geography, scoring, approval, or publication decision.

The repository retains the North Carolina State Board of Elections' complete election-result archives for the May 17, 2022, March 5, 2024, and March 3, 2026 primaries. It also retains the exact state-canvass-by-contest PDFs published for 2022 and 2024. The deterministic acquisition command is:

```sh
npm run fetch:nc-house-primary-results
```

The result archives are the complete statewide files, not a hand-selected set of districts or candidates. They contain precinct and administrative-reporting rows, candidate party labels, voting-mode counts, totals, and the `Real Precinct` marker. A later receipt must choose one nonduplicative aggregation basis and reconcile it to the canvass before reporting candidate totals.

## Certification boundary

The 2022 and 2024 result archives have separately retained state canvass documents. The 2026 archive is retained because NCSBE publishes it through the same official historical-results channel, but this receipt does not call every 2026 federal contest certified. NCSBE's March 25, 2026 notice deferred U.S. House districts 1, 3, 6, 10, 11, and 13 while provisional ballots were corrected; the retained archive itself was regenerated April 16. The result parser must preserve district-level certification availability and may not infer certification from archive presence alone.

## Lifecycle boundary

These files are source evidence only. No result has been linked to a current incumbent, reconciled to historical geography, classified as progressive, exposed to the evaluator, approved by the user, promoted to a factual release, deployed, or shown publicly. Missing contest rows must remain unresolved rather than becoming zero, uncontested, or no-primary facts.

Run `npm run data:verify` to verify all retained bytes against [`data/source-lock.json`](../../data/source-lock.json).
