# California primary identity-geography joint review package v1

Status: **proposed reviewer queue; no approval, evaluator use, publication, or deployment**

This immutable package joins the exact 126 California target-seat identity observations to their matching geography rows. It gives the reviewer one queue while leaving identity, geography, and top-two treatment as three independent unresolved decisions.

| Review category | Rows | Reviewer action |
| --- | ---: | --- |
| Identity and geography candidates | 76 | Review both relationships independently. |
| Geography candidate; identity unresolved | 8 | Retain the geography evidence and resolve the historical nonappearance without substituting a prior officeholder. |
| Identity candidate; CD120 geography pending | 38 | Review identity while retaining the 2026 map relationship as authority-pending. |
| Identity unresolved; CD120 geography pending | 4 | Preserve both unresolved states. |

The queue contains 114 identity candidates and 84 geography candidates. Every record has `identity.approved: false`, `geography.approved: false`, `jointApproved: false`, and `scoreEligible: false`. The queue creates no automatic resolution and does not mutate either parent.

California remains a voter-nominated top-two system throughout the join. Party preference is not nomination; no winner or advancement is introduced; `formulaApplicability` remains `confirmed_incompatible_with_party_primary_metrics`. The 42 CD120 rows retain null historical GEOIDs even where identity evidence exists.

## Immutable identities and reproduction

- Artifact SHA-256: `39a812f0d7ec0b1ea7530df48aa55f0f4621e5237d633bb6f5e643e6ee6a2391`
- Package SHA-256: `07c0935ab49783ae697ff7f7b395d16fccca00ee5f4bd688b6ac76fe677d0a2f`
- Review-record-set SHA-256: `cf7080937aae4351277c8a7314b104bc0fca6e3f66208451a3649060eab217a8`

```sh
npm run generate:ca-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/california-primary-identity-geography-review-package.test.ts
npm run data:verify
npm run typecheck
```

Generation binds the exact source-selection proposal and both immutable parent candidates, verifies their unresolved review states and source-lock records, joins on contest/seat/cycle/hash closure, sorts bytewise, and refuses to overwrite differing output. The queue contains only the minimal candidate and geography fields already present in its parents; no address, contact, date-of-birth, donor, or raw geometry fields are added.
