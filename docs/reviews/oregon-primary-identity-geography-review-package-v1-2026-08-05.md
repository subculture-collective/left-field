# Oregon primary identity/geography joint review package v1

Status: **proposed reviewer queue; not approved, published, or evaluator-eligible**

This package joins the exact 15 current-target identity observations to their matching geography rows without approving either parent:

- eight rows have identity and geography candidates pending independent review;
- two 2022 predecessor rows have geography candidates but unresolved current-incumbent identity;
- five 2026 rows have identity candidates but CD120 geography authority remains pending;
- zero rows are jointly approved or score-eligible.

The predecessor rows are Oregon districts 3 and 5 in 2022. The CD120-pending rows cover all five current Democratic Oregon target seats in 2026. The join cannot turn a source nominee marker, exact name, alias, matching district key, or parent candidate into approval, evaluator input, or publication.

```sh
npm run generate:or-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/oregon-primary-identity-geography-review-package.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `4ec88e16e56a6c48b4224b030ea3fd59f507dbd2832ddf4609fbfaff3bf44085`

Review-record-set SHA-256: `8a60f3044c903a45fa59fe91934a4916d8be062d81ea7edd5bbfc888c1d4c6a2`
