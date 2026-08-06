# Connecticut primary nomination authority receipt v1 — 2026-08-06

## Outcome

This reviewer-only receipt records ten manually inspected Democratic U.S. House party-endorsement forms: districts 1–5 for 2022 and 2024. The names are John B. Larson, Joe Courtney, Rosa L. DeLauro, Jim Himes, and Jahana Hayes in their respective districts for both cycles. The official 2024 statewide Democratic primary candidate list contains zero congressional-office rows.

These are endorsement and candidate-list observations, not nomination or result conclusions. Every row keeps `nominationStatus` and `resultStatus` null, remains score-ineligible, and is proposed rather than approved or published. The 2024 CD4 bundle's `--15` filename is not interpreted as Democratic evidence: visual review identifies Jim Himes's Democratic form as endorsed, while the bundle's 15-percent material belongs to a separate party record.

## Authority and limitations

Connecticut General Statutes §§ 9-400, 9-415, and 9-416 make the nomination consequence depend on whether another valid candidacy was filed through the convention or petition paths. Sections 9-426 and 9-429 also allow a scheduled primary to disappear after withdrawal, death, disqualification, or cancellation. Therefore neither an endorsed form nor an absent result/list row independently proves an uncontested nomination or primary winner.

The ten certificate PDFs and the 28-page statewide candidate list contain residential addresses. They are exact URL/size/SHA-256 source-lock entries with `retainedStatus: nonretained`; the derived artifact keeps only cycle, district, party, candidate name, form selection, source ID, and hashes. Reuse licensing remains unassessed.

## Integrity and reproduction

The receipt has exactly fourteen direct parents: three retained official index pages, ten nonretained certificate bundles, and one nonretained statewide candidate list. It contains 10 observations, each with a privacy-safe page-one Democratic-form locator. Its observation-set SHA-256 is `06cf41e520d216683e81c24af30cf6031a5b0fae25b037c89d563a81f16367f0`, package SHA-256 is `1451a3928a40cc1a21755619e4e6f1c55276c826f1c5d8ec9d96612ebe3771db`, and artifact SHA-256 is `076b40df2f7fbac8325e2131c3fd000967d3c944c74932e7dcb49954fcd9bacb`.

```bash
DSA_SEATS_CT_NOMINATION_AUTHORITY_CACHE_DIR=/path/to/exact/cache npm run fetch:ct-primary-nomination-authority
npm run generate:ct-primary-nomination-authority
npx vitest run scripts/fetch-connecticut-primary-nomination-authority.test.ts src/ingestion/elections/connecticut-primary-nomination-authority-receipt.test.ts
npm run data:verify
```

The remaining disposition gate is a complete final Democratic candidacy/ballot universe plus statutory cancellation status and a final general-election nominee cross-check. Identity, historical geography, classification, human review, and publication remain separate unresolved gates.
