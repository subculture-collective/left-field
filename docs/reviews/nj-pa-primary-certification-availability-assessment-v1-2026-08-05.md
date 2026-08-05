# NJ/PA primary certification availability assessment v1

Status: **proposed reviewer-only authority assessment; not certification, approval, score input, promotion, release, or deployment**.

## Result

The assessment binds six New Jersey and Pennsylvania primary state-cycles to exact retained result and certification-context evidence under the existing nationwide decision `collect-official-state-primary-results-and-certification-v1`.

| State cycle | Exact result bytes | Certification context | Exact result/certification reconciliation |
| --- | --- | --- | --- |
| NJ 2022 | Official Division result candidate retained | New Jersey law requires a distinct post-canvass Secretary certificate; that certificate was not located or retained | No |
| NJ 2024 | Official Division result candidate retained | Same distinct statutory certificate requirement; certificate not located or retained | No |
| NJ 2026 | Official Division result candidate retained | Same distinct statutory certificate requirement; certificate not located or retained | No |
| PA 2022 | Department precinct extract retained | No cycle certification statement retained; readme dates the extract to election day | No |
| PA 2024 | Department precinct extract retained | Statewide certification statement retained; extract is dated 50 days later, but the statement does not identify or hash it | No |
| PA 2026 | No resolvable result extract retained | Statewide certification statement retained | No result exists in the repository to reconcile |

Five exact result artifacts and two statewide Pennsylvania certification statements are retained. Zero exact result artifacts are certification-reconciled, automatically approved, score eligible, or public. Pennsylvania 2022 districts 13, 14, and 15 remain unresolved—not zero, uncontested, or no-candidate dispositions.

## Authority boundary

New Jersey's exact result PDFs remain strong `Official List` evidence. N.J.S.A. 19:23-57 separately requires the Secretary of State to canvass county-clerk statements for the state or portions thereof involving more than a single county or congressional district and issue a certificate to each person shown to have been nominated. The pre-election `Certification of Primary Election Nominees` files are ballot/petition certifications and are not substituted for that post-election instrument.

Pennsylvania's Department says countywide returns remain unofficial until certified, official countywide returns are certified under the Secretary's seal, and official precinct returns are maintained by county boards. The retained 2024 announcement proves statewide election certification after all counties certified; it does not bind the exact Department precinct-export bytes. The 2026 announcement likewise cannot substitute for a missing result extract.

Absence of a retained artifact is an acquisition status, not proof that the artifact does not exist. Re-entry requires a stable official result asset plus an authoritative certificate or complete reconciliation that identifies the same result scope. Every identity, geography, contest-disposition, progressive-classification, human-review, and publication gate remains open.

## Immutable identity and reproduction

```bash
npm run fetch:nj-pa-primary-certification-authority
npm run generate:nj-pa-primary-certification-availability-v1
npm run test:run -- src/ingestion/elections/nj-pa-primary-certification-availability-assessment.test.ts
npm run data:verify
```

- Artifact: `data/metadata/nj-pa-primary-certification-availability-assessment-v1.json`
- Artifact SHA-256: `49ef2ecf530cd3f76de03c780b343d49837171dfe6e0f76acac1405b735301ef`
- Package SHA-256: `7cf437c67e4b457e110ae03cc0ef0f88afc004fb0c19a279d4646fa8a163fa4a`
- Row-set SHA-256: `7c91368a0e77c29cc9fd593cbf1d3d27f0d4eaafba07435662222067e9c4612a`
- Exact certification reconciliations: `0`
- Automatic approvals: `0`
- Score-eligible rows: `0`
