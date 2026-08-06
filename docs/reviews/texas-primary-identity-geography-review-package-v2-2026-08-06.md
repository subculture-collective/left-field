# Texas primary identity-geography review package v2

## Outcome

Texas joint review v2 composes the immutable 78-record joint-review v1 parent with Texas geography v2. It preserves all identity, event, contest, source-observation, certification, result-disposition, and progressive-classification facts while replacing the 26 PlanC2333 geography placeholders with exact row-hash-bound split-crosswalk evidence.

The review categories are 25 records with both identity and geography candidates, 27 geography-candidate/identity-unresolved records, eight identity-candidate/crosswalk-review-required records, and 18 identity-unresolved/crosswalk-review-required records. The package retains 33 identity candidates and 52 geography candidates. No 2026 geography candidate is created.

All five reviewer decisions remain proposed with null reviewer, timestamp, and resolution. The geography decision now accurately recommends retaining the 26 PlanC2333 split rows for crosswalk review instead of describing their authority as uncollected. Certification, regular/runoff disposition, progressive-classification, and publication gates remain unchanged. Every identity approval, geography approval, joint approval, evaluator value, score eligibility, and publication eligibility remains false or absent.

The generated artifact is 277,078 bytes with file SHA-256 `3e8f31e9bc92403f0a3223fd793ddab694d45bf42dc6054f85761099d7a38072`, package SHA-256 `f2754f86afd5435284676c218bcb96a42c67b498a835a0f42ecf81275ab57fbb`, review-record-set SHA-256 `fe7306a4259113846f6727084308b43df3457da675973250d23a904dd38f0f1e`, and decision-set SHA-256 `d6493dfcf4ee11f3017a049a9d655c7105172a2097a0d897781f35423d632f22`.

## Reproduction

```bash
npm run generate:tx-primary-joint-review-v2
npx vitest run src/ingestion/elections/texas-primary-identity-geography-review-package-v2.test.ts
npm run data:verify
```
