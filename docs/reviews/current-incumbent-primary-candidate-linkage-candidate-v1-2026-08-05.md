# Current-incumbent primary-candidate linkage candidate v1

Status: **proposed reviewer-only relationship evidence; not an accepted identity mapping, selected contest, score input, release, or deployment**.

## Result

This immutable candidate joins the 16 current Democratic target seats in New Jersey and Pennsylvania to all 41 same-district/cycle observations present in the retained state primary-result candidates. It finds 33 reviewable current-incumbent candidate appearances and preserves eight historical nonappearances. No relationship is automatically approved, score eligible, or public.

| Evidence class | Rows | Meaning |
| --- | ---: | --- |
| Exact name observation | 18 | The state-printed name equals the official House Clerk name after declared case, punctuation, spacing, and suffix normalization. This is still not identity approval. |
| Derived relationship | 9 | A retained Congress Current alias or transparent official-name middle-token variation produces one same-district candidate. |
| Inferred relationship | 6 | A unique same-district candidate shares the official surname and first initial, or uniquely shares the official first name; legal, nickname, married-name, or family-collision risk remains. |
| Historical nonappearance | 8 | No unique current-incumbent candidate appears; the row remains unlinked and is not a conflict, zero, uncontested result, or substitute prior officeholder. |

The six lower-confidence inferred rows cover NJ-08 in 2022, NJ-09 in 2026, PA-04 in 2022/2024, and PA-06 in 2022/2024. The eight nonappearances reflect earlier officeholders or an open primary: NJ-03 in 2022; NJ-09, NJ-10, and NJ-11 in 2022/2024; and NJ-12 in 2026.

## Evidence and boundaries

The candidate binds exact bytes for the target roster, the unchanged August 4 source-selection proposal, official House Clerk MemberData, the retained Congress Current identity dataset, and the NJ/PA result candidates. It records the later August 5 evidence cutoff without claiming to supersede the August 4 proposal.

Name equality, the NJ source incumbent/winner markers, and PA source candidate numbers are observations—not authoritative bridges to BioGuide. PA vote totals never infer a winner. Historical geography remains unassessed, progressive classification remains absent, and all evaluator use is `excluded_pending_authorized_identity_review`.

The artifact provides `decisionSupport` to existing decision `approve-historic-primary-candidate-identity-resolution-v1`. It creates no new decision ID, decision hash, review lifecycle, or publication block. The parent decision remains unresolved.

Privacy is intentionally narrow: state candidate names, PA source candidate numbers, votes, and minimal identity references are retained for review; candidate addresses, phone/email/date-of-birth fields, donor records, and raw source text are excluded.

## Immutable identity and reproduction

```bash
npm run generate:current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/current-incumbent-primary-candidate-linkage-candidate.test.ts
npm run data:verify
```

- Artifact: `data/metadata/current-incumbent-primary-candidate-linkage-candidate-v1.json`
- Artifact SHA-256: `d4b05e851c9024cad4076e07cf921cc21176ae3d2e92caaf4e847b5a9d85f53d`
- Package SHA-256: `cea679fcc77960acf076de64d1d8fe4bbac668a024af7e345332f1effa76a4f4`
- Link-set SHA-256: `96939a1e8ea480299a5bd34b6756c25367be092d4e26f8929ed1779cc437741c`
- Automatic approvals: `0`
- Score-eligible links: `0`
