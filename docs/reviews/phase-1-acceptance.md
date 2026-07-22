# Phase 1 public-MVP acceptance

**Repository engineering mechanisms: ACCEPTED. Public factual-profile MVP: NOT ACCEPTED. Public launch: BLOCKED.** This is an evidence record, not a scope waiver or a production claim.

## Acceptance base and evidence classes

Final successful acceptance run: **2026-07-22**. It used a fresh isolated Compose volume, three pairwise-distinct database lanes, exact opt-in, restricted web login, and loopback test URLs. Acceptance documentation remains uncommitted.

| Class | Evidence | Disposition |
|---|---|---|
| Repository/static | Next/TypeScript/Drizzle; six immutable migrations; 70-table schema; source lock | accepted mechanism evidence |
| Disposable integration | PostgreSQL 16.4/PostGIS 3.4 local `_test` evidence; harness does not create/drop databases; CI provisions disposable DB/volume | accepted mechanism evidence from fresh isolated run |
| Release/publication | R1 identity/geography only | recorded; not public-MVP acceptance |
| Candidate/synthetic | R2, R3, R4 and browser/query/drill fixtures as identified below | non-production mechanism evidence only |
| Manual/deployment | WCAG/AT, correction lifecycle, lookup privacy/vendor/canary, production retention/telemetry | blocked |

### Migration fingerprints

| Migration | SHA-256 |
|---|---|
| `0000_phase_1.sql` | `f787611116580a526ee3d4990709b14fe11d0fca78f810409bd6b0b8b7da8164` |
| `0001_phase_1_nationwide.sql` | `542dd1e1d2d922060d060a5fcef93167bdec1271626b78199d96008a7a2f7967` |
| `0002_ingestion_integrity.sql` | `a405ddf92045f1f227bc2b3eff6e9e9dc844bcf2e65f3a1b1b779f250b9a4697` |
| `0003_steep_kid_colt.sql` | `cede2fd4c5fd0cf2da02a5213446f68bf7a2ef4768c5c6a8ec3d2aa8df36a583` |
| `0004_large_johnny_storm.sql` | `41dfabccc60cddd7bdb84e78b963b66dbb153e3cf190ce64c277319802cd52be` |
| `0005_petite_black_bolt.sql` | `7427e0a9523082e0b608d8083f3e0c395fe6320c280ddf7c26723c7b76302f1d` |

The current source lock contains **96 entries: 89 retained + 7 nonretained**.

## Universe, health, and release/domain matrix

The source cutoff is **2026-07-18**. The defined identity universe is **541 current offices: 435 voting House, 5 delegates, 1 resident commissioner, and 100 Senate**; it is distinct from the **497 valid geometries: 441 House and 56 jurisdiction**. Senate classes are **33/33/34**. The R1 identity evidence has 537 current people, which implies **4 explicit vacant seat cycles**. The current builder reports **0 special-election seat cycles** and marks every cycle regular; this is catalog modeling, **not** a claim that no real special elections occurred. The health contract's exact universe fields are `totalSeats=541`, `votingHouse=435`, `delegates=5`, `residentCommissioner=1`, `senate=100`, `senateClass1=33`, `senateClass2=33`, `senateClass3=34`, `jurisdictions=56`, and `sourceCutoffPresent=1`; geometry fields are `geometries=497`, `houseGeometries=441`, `jurisdictionGeometries=56`, and `invalid=0`. Observation coverage remains independent of identity closure.

`release:health` is a restricted-preflight, sanitized report with exactly these checks: `preflight_access`, `universe`, `geometry`, `source_provenance`, `coverage_quarantine`, `ingestion`, `validation_gate`, `repository_smokes`, `rollback_drill`, `production_telemetry`, and `launch_blockers`. Provenance reports `sources`, `snapshots`, `approved`, `restricted`, and `reviewRequired`; quarantine reports `coverageRecords` and `quarantined`; ingestion reports `running` and `failed`; the validation gate reports `domains=7`; repository smokes report `smokes`; drill reports `verified` and `durationMs`; telemetry is `status=not_observed`; blockers report `blockers`. All are counts/statuses/durations, not payloads or credentials. Production telemetry is `not_observed`.

| Release/domain | State | Acceptance meaning |
|---|---|---|
| R1 identity/geography | published | 541-office / 497-geometry skeleton only |
| R2 members, ACS, finance | candidate-only | not public factual enrichment |
| R3 elections | candidate-only/blocked | state/year review and reconciliation still required |
| R4 maps, corrections, lookup | disabled/blocked | no production retention, privacy/lifecycle, accessibility, or deployment acceptance |

## Current query evidence

`phase-1-r1-query-plans.json` was generated **2026-07-22T01:02:07.068Z** on PostgreSQL 16.4 and labels itself **synthetic query-shape evidence, not semantic validation or production benchmarking**. It contains **100,000 ACS observations**, **100,000 ACS lineage rows**, and **541 seats**. The full-profile warm p95 is **108.7838910000064 ms** over 10 repetitions; `getSeatProfile` uses **10 statements**. Bounds are a 15,000 ms statement timeout, 51 browse root rows, 541 list-join rows, and 5,200 dense-profile facts.

| Artifact hash | SHA-256 |
|---|---|
| profile SQL | `3cb2c5cbc23a0cea5cd544674a6af94d4ec95823a834444b7e4133fafd7332b2` |
| recursive closure SQL | `51169c6c7efa9a89f0de3cf69f2c2d68e8155415e69c357737983d6f5b792c0c` |
| `state-asc` plan | `54a927b774f7129557a53db48ec3de891ecccc8c51e91048491c817a0fad4037` |

## PRD acceptance criteria

| PRD criterion | Result | Evidence boundary |
|---:|---|---|
| 1 | **PASS** | Canonical R1 universe is closed: 541 offices and 497 geometries, with the stated cutoff, classes, vacancies, and catalog-modeling caveat. |
| 2 | **BLOCKED** | Lookup is disabled; no shared privacy gate or production canary. |
| 3 | **BLOCKED** | R2/R3 factual domains are not published and release-wide final evidence is absent. |
| 4 | **PASS** | The implemented non-ranking demographics surface and demographic-isolation mechanisms passed the final technical gate; this is not factual enrichment publication. |
| 5 | **BLOCKED** | R3 publication/review evidence is absent. |
| 6 | **BLOCKED** | R2 finance is not published. |
| 7 | **PASS** | Repository engineering mechanisms and final technical gate passed. |
| 8 | **PASS** | The versioned corpus mechanism is implemented, but is not activated. |
| 9 | **BLOCKED** | Infrastructure/vendor review and controlled production canary are incomplete. |

No address criterion is waived. Automated Axe results are not WCAG conformance; manual WCAG 2.2 AA and assistive-technology review remain blocked.

## Task 14 and specialist findings

The final run recorded migrations `0000`–`0005`; **35/35** guarded PostgreSQL scenarios in **545.55s**; **588/588** non-guarded tests across **77 files** in **57.22s**; **32/32** desktop and exact-390px browser checks in about **1.2m**; typecheck; lint with **0 errors and 1 existing warning**; Next **16.2.11** build; 96-entry source lock; `npm audit --audit-level=low` with **0 vulnerabilities**; Compose validation; 70-table Drizzle no-drift; and diff checks. The security remediation is approved: **sharp 0.35.3 / libvips 8.18.3**. It proves role separation, single-use/stale/expired proof rejection, five-domain invalidation, immutable preservation, rollback and roll-forward, and sanitized opt-in signals. It does **not** prove production telemetry, real R2/R3/R4 publication, production map retention/credentials, correction activation, or lookup activation.

Final Task 15 specialist dispositions are: data integrity/query plans **APPROVED**, security **APPROVED**, UI mechanism **APPROVED**, and architecture/merge readiness **APPROVED**. Manual WCAG/AT validation remains blocked. Activation blockers remain exact: correction access/retention/cleanup, malicious-link moderation, emergency redaction/deletion, trusted edge and direct-ingress exclusion; lookup infrastructure/redaction/vendor/egress/two-person/canary approval; production telemetry; production map retention/runtime credentials; R2, R3, and R4 publication; and the address privacy lifecycle.

CI/harness status: the checked-in harness requires exact opt-in, loopback `*_test` URLs, non-production `NODE_ENV`, dedicated Task13 map root, guarded integration with explicit `TEST_DATABASE_URL`, non-guarded tests, query measurement, typecheck, lint, build, source lock, audit, Compose, Drizzle, diff checks, and seeded browser checks. CI provisions the disposable DB/volume; the final run used three pairwise-distinct lanes and restricted web login.

## Task 15 steps

| Step | Result |
|---:|---|
| 1. Recreate database from zero | **PASS** — fresh isolated Compose volume and three pairwise-distinct database lanes. |
| 2. Verify defined universe | **PASS** — cutoff, 541/497 closure, classes, vacancies, and catalog-modeling caveat recorded above. |
| 3. Complete technical gate | **PASS** — final successful `npm run test:acceptance` evidence recorded above. |
| 4. Product/security/accessibility gates | **BLOCKED** — factual publication, manual WCAG/AT, correction lifecycle, and lookup activation gates remain. |
| 5. Specialist review | **PASS** — data, security, UI mechanism, and architecture reviewers approved repository merge readiness. |
| 6. Commit acceptance evidence | **PASS** — this Task 15 acceptance/readiness commit records the final evidence and blocked-launch verdict. |

There is **no aggregate green** over blocked product/deployment criteria. Repository engineering mechanisms are **ACCEPTED**. Public factual-profile MVP remains **NOT ACCEPTED** and public launch remains **BLOCKED**.
