# Federal Seat Research — Technical Architecture

## 1. Architecture decision

Build a **modular monolith backed by PostgreSQL/PostGIS**, with offline ingestion jobs and immutable published data snapshots.

This is intentionally not a microservice architecture. The MVP benefits more from transactional publishing, simple deployment, reproducible analytics, and explicit module boundaries than from independent scaling.

## 2. System context

```text
Official/derived sources
  Census | ACS | TIGER | FEC | Congress.gov | Clerk | Senate
  GovInfo | state returns | MEDSL | optional OpenSecrets
                     |
                     v
          Extract -> immutable raw snapshots
                     |
                     v
       Stage -> validate -> identity resolution -> core DB
                     |
                     v
        derive metrics -> validate release -> publish snapshot
                     |
                     v
       Web application / public read API
                     ^
                     |
         Census Geocoder (transient address lookup only)
```

## 3. Recommended stack

- **Web application:** TypeScript, Next.js, server-rendered public pages.
- **API:** Next.js route handlers or a small Fastify service in the same deployable; choose one after the prototype, not both.
- **Database:** PostgreSQL 17+ with PostGIS.
- **Transforms:** SQL/dbt for deterministic staging, tests, core models, and analytics marts.
- **Ingestion:** TypeScript or Python jobs, selected per source library quality; jobs share contracts rather than a runtime.
- **Raw storage:** S3-compatible object storage with checksums and retention/versioning.
- **Job execution:** Scheduled container jobs or a managed scheduler; no workflow engine in MVP.
- **Maps:** Pre-generated vector tiles or simplified GeoJSON derived from TIGER/Line.
- **Search:** PostgreSQL full-text/trigram search; no separate search service initially.
- **Caching:** CDN for snapshot-addressed public responses. Avoid Redis until measured need.
- **Observability:** structured logs, job metrics, data-quality results, release status, and error reporting with address-field redaction.

Specific framework versions should be selected when implementation begins and verified against current official documentation.

## 4. Module boundaries

### Address resolution

- Accepts an address and calls the Census Geocoder.
- Uses returned coordinates transiently for point-in-polygon against the pinned product House geography, then maps the state to both current Senate office terms.
- Returns only canonical seat identifiers, match status, geocoder vintage, and product geography vintage; material vintage mismatch is an explicit failure state.
- Never persists request bodies, normalized addresses, or coordinates.
- Uses explicit logging redaction and does not send address text to product analytics.

### Seat catalog

- Owns offices, terms, seat cycles, district plans, and geography versions.
- Provides stable internal identifiers; labels such as `CA-12` are not historical identities.

### Research facts

- Serves election, ACS, incumbent, and finance observations.
- Requires provenance, time, geography, unit, methodology, and quality metadata.

### Evidence

- Stores source documents, exact citations, actions/statements, controlled tags, and editorial review state.
- Separates primary-source facts from analyst classifications.

### Analytics and ranking

- Computes immutable metric and ranking runs from a fixed source cutoff.
- Owns versioned formulas, cohorts, normalization, missing-data policy, and component lineage.
- Cannot consume voter-level data or prohibited demographic/issue fields.

### Ingestion and release administration

- Stores immutable raw responses/files.
- Validates source records and deterministic identity mappings.
- Publishes a release atomically only after required tests pass.
- Public readers never query half-complete ingestion tables.

## 5. Public API sketch

This is an internal conceptual interface, not a stable public contract for the MVP. Publish and version an external API only after actual consumers and post-MVP domains are approved.

All read responses include `release_id`. Metric objects additionally include provenance and quality fields.

```http
POST /api/v1/address/resolve
GET  /api/v1/seats
GET  /api/v1/seats/{seat_id}
GET  /api/v1/seats/{seat_id}/facts
GET  /api/v1/seats/{seat_id}/evidence
GET  /api/v1/seats/{seat_id}/scores
GET  /api/v1/rankings?kind=primary&cycle=2026&release_id=...
GET  /api/v1/compare?seat_id=...&seat_id=...
GET  /api/v1/methodologies/{version}
GET  /api/v1/releases/{release_id}
POST /api/v1/corrections
```

### Metric contract

```json
{
  "metric": "presidential_two_party_dem_share",
  "value": 67.4,
  "unit": "percent",
  "as_of": "2024-11-05",
  "sources": [
    {
      "role": "original_publisher",
      "name": "State election authority",
      "url": "https://example.invalid/certified-return",
      "source_snapshot_id": "snap_state_..."
    },
    {
      "role": "standardization_intermediary",
      "name": "MEDSL",
      "url": "https://example.invalid/standardized-release",
      "source_snapshot_id": "snap_medsl_..."
    }
  ],
  "geography_version_id": "geo_...",
  "methodology_version": "election-overlay-v1",
  "status": "modeled",
  "quality": {
    "coverage_percent": 98.7,
    "source_quality": "derived_from_certified",
    "allocation_uncertainty": "medium"
  },
  "missing_reason": null
}
```

Do not collapse statistical uncertainty, geographic-allocation uncertainty, source quality, and coverage into one unexplained confidence number.

### Address endpoint safeguards

- Request-body and outbound-URL logging disabled or redacted at application, proxy, CDN, WAF, APM, and error-reporting layers.
- `Cache-Control: no-store`.
- Rate limiting based on ephemeral/security-safe identifiers, not stored addresses; identifier retention is documented and bounded.
- Response excludes exact matched coordinates and normalized street address.
- Geocoder benchmark and vintage returned.
- Session replay and third-party analytics are prohibited from the entire lookup page. Form DOM values, traces, headers, and outbound geocoder URLs are covered by redaction/configuration review.
- Product disclosures identify the Census Geocoder as an external processor and avoid promising that external systems never retain requests.

## 6. Core relational model

```text
provenance
  source
  source_snapshot
  ingest_run

geography
  district_plan
  geography_version
  geography_crosswalk

elections
  person
  external_identifier
  office
  office_term
  election_cycle
  seat_cycle
  contest
  candidacy
  election_result

census
  acs_release
  acs_variable
  acs_observation

campaign_finance
  committee
  committee_relationship
  fec_filing
  contribution_aggregate
  finance_summary

congress
  congressional_membership
  bill
  bill_version
  roll_call
  vote_cast

evidence
  source_document
  evidence_event
  evidence_citation
  evidence_tag
  editorial_review

analytics
  metric_definition
  metric_value
  metric_input

post_mvp_analytics
  ranking_definition
  ranking_run
  ranking_item

publishing
  data_release
  correction_request
```

### Identity rules

- `person`, `candidacy`, `office`, `office_term`, and `committee` are separate entities.
- External IDs are source-scoped. Prefer Bioguide for members and FEC candidate/committee IDs for campaign finance.
- No fuzzy donor-person entity resolution in MVP.
- Enforce unique source natural keys in addition to surrogate IDs.
- Party affiliation, office holding, committee relationships, and incumbency are dated relationships, not mutable booleans.

### Geography rules

- A `district_plan` represents an enacted map, separate from a TIGER file release.
- A `geography_version` binds geometry to plan, source, vintage, and effective cycles.
- Every seat cycle and contest points to a geography version.
- Historical results remain attached to original boundaries.
- Historical-to-current estimates are separate metric values with crosswalk method, input geography, coverage, and uncertainty.

### Observation rules

- ACS values store release, survey period, universe, variable, estimate, MOE, unit, and geography version.
- Election results store contest/round, certification status, votes, denominator, completeness, and source reporting-unit identity.
- MVP finance ingestion uses FEC filing summaries and licensed aggregates rather than retaining itemized contributor records. If later transaction processing proves necessary, it requires separate purpose/legal review, isolated short-lived processing, no person resolution, and documented retention/suppression controls.
- Evidence citations retain exact quote/action location, document version, retrieval date, and review status.
- `NULL` never means zero; use enumerated missing reasons.

## 7. Data pipeline

### 1. Extract

- Download each permitted API response or file unchanged. Source-specific retention and redistribution rules may require selective fields, expiration, or no retained raw copy.
- Create `source_snapshot` with request/URL, release ID, publication time, retrieval time, checksum, license, parser version, and raw-object path.
- Enforce source-specific retention, redistribution, attribution, and expiration policy before writing or publishing a snapshot.
- Make extraction repeatable and rate-limit aware.

### 2. Stage

- Parse into source-specific staging tables.
- Preserve raw source keys and values.
- Quarantine parser errors instead of dropping rows.

### 3. Validate

Required checks include:

- Unique source keys and referential integrity.
- Expected seat/member/contest coverage.
- Geography vintage compatibility.
- Election subtotal-to-total reconciliation.
- FEC filing-summary amendment chains, included committees, reporting periods, and reconciliation to source totals.
- ACS variables, universes, units, and MOEs.
- Evidence citation URL/document integrity.

### 4. Resolve identities

- Use deterministic source IDs and reviewed mapping tables.
- Queue ambiguous member/candidate/committee matches for manual review.
- Never silently fuzzy-merge people.

### 5. Load core

- Append versioned source facts idempotently.
- Preserve corrected and superseded records.
- Build replaceable canonical-current views without deleting history.

### 6. Derive

- Run transformations against a fixed source cutoff.
- Store formula version, code commit, parameters, normalization cohort, denominator, input lineage, and effective weights.
- Materialize immutable metric and ranking runs.

### 7. Publish

- Validate candidate release.
- Atomically mark one release `published` and update the public pointer.
- Retain prior releases for audit and rollback.
- CDN keys include release ID so mixed snapshots cannot occur.

## 8. Election-result derivation

Preferred order:

1. Certified result published on the exact district boundary.
2. Certified precinct/reporting-unit returns intersected with the chosen district plan.
3. Trusted standardized returns, such as MEDSL, reconciled to state totals and intersected with the plan.
4. No value when geography or coverage is not defensible.

For overlays, preserve source reporting-unit geometry, split/allocation method, absentee/early-vote treatment, coverage, reconciliation delta, and rounding policy. Never describe reaggregated values as official district results.

### Phase 0 feasibility research backlog

The Phase 0 artifact is a planning-only matrix with exactly 102 jurisdiction-cycle rows: the 50 states plus the District of Columbia for both 2020 and 2024 presidential general elections, targeting `TIGER2025/CD119`. It records source authority, reporting unit, geometry, non-geographic vote handling, licensing, allocation, reconciliation, rounding, and expected coverage gates.

`not_assessed` is an allowed Phase 0 gate value. A row with any unassessed gate remains `state_specific_research_required`; a result landing page alone cannot upgrade feasibility. The matrix is not a certification finding, modeled result, or completed state-specific feasibility determination. Upgrading a row requires separately reviewed, source-locked evidence for every relevant gate.

## 9. Ranking implementation (post-MVP)

- Store formulas in version-controlled code and a human-readable methodology record.
- Implement only after the PRD component-dictionary gate is complete; compute primary and general-election rankings independently.
- Validate weights total 100% and that no prohibited field enters dependency lineage.
- Validate normalization stability, especially for small Senate cohorts; use fixed declared bounds where cohort-relative normalization causes unrelated-seat drift.
- Publish raw component values, normalized values, effective weights, contribution to total, coverage, and rank ties.
- Do not rank seats missing any designated core component; show an unranked component summary instead.
- Run historical backtests with contemporaneous cutoffs; do not claim causal or predictive validity from descriptive fit.

## 10. Security and privacy

### Data classification

- **Transient sensitive input:** submitted street address.
- **Public aggregate:** district facts, aggregate finance summaries, citations, and ranking outputs.

### Controls

- Field-level redaction tests for addresses and raw contributor attributes.
- Least-privilege database roles: ingestion, editorial, publisher, and public read.
- Itemized FEC contributor records are not retained for the MVP. Aggregate/suppress finance cells that could become de facto individual lookup.
- CSRF protection and abuse controls on correction submissions.
- Dependency and container scanning; secret manager for API keys.
- Audit log for editorial changes and release publication.
- Backups and point-in-time recovery for database; object versioning for raw snapshots.

## 11. Editorial workflow

Evidence states:

```text
ingested -> needs_review -> verified -> published
                       \-> rejected
published -> corrected -> republished
```

Automation may propose topic tags but cannot publish interpretive evidence without human review. A correction creates a new version and preserves the prior citation and review record.

## 12. Testing strategy

### Unit

- Source parsers, identifiers, score normalization, missingness, and effective weights.
- Address redaction and response minimization.
- Evidence classification rules and citation formatting.

### Data contracts

- Source schema drift, uniqueness, relationships, expected coverage, geography compatibility, and reconciliation totals.
- Prohibited-field lineage test for rankings.
- Snapshot checksums and immutable-release constraints.

### Integration

- Census address resolution using recorded sanitized fixtures.
- FEC amendment/canonical-projection cases.
- Congress member-to-vote linking.
- Full candidate-release validation and atomic publish/rollback.

### End-to-end

- Find seats without persisted/logged address data.
- Browse, filter, compare, inspect sources, and submit corrections.
- Confirm modeled results and partial scores have visible warnings.
- Accessibility checks for keyboard, screen-reader labels, focus, contrast, and data-table alternatives.

### Golden datasets

Maintain 10–12 representative retained-data seats plus an executable coverage ledger. The ledger must distinguish:

- canonical real-data cases, including at-large districts, boundary changes, special-election history, amended FEC summaries, and ACS estimates/MOEs;
- explicitly synthetic contract fixtures, including non-voting-delegate eligibility, modeled-result validation, scoring, and future evidence-review states; and
- documented gaps, including any uncontested race, incomplete precinct allocation, or Sanders 2020 case not supported by retained authoritative data.

Do not fabricate a real-data case to satisfy the matrix. Closing a documented gap requires a separately reviewed, source-locked acquisition.

## 13. Deployment shape

Initial production deployment can use:

- One web container or serverless application.
- Managed PostgreSQL/PostGIS.
- Object storage for raw snapshots and map artifacts.
- Scheduled ingestion containers.
- CDN for public snapshot responses and assets.
- Separate staging and production databases/buckets.

A release is promoted, not rebuilt, between staging and production. Rollback changes the active release pointer; it does not rerun transformations.

## 14. Key architecture risks

| Risk | Mitigation |
|---|---|
| District identity changes | Plan- and vintage-bound seat cycles; never use district label alone. |
| Modeled results mistaken for certified facts | Separate statuses, visual labeling, methodology, and quality metadata. |
| FEC totals change after amendments | Preserve versions and publish explicit canonical projections/cutoffs. |
| Address leakage through logs/vendors | Transient proxy, no-store, redaction tests, analytics exclusion, vendor-term review. |
| Evidence becomes unsupported editorial labeling | Primary citations, neutral tags, human review, correction/version history. |
| Rankings hide missingness or bias | Separate score types, visible components, explicit missing reasons, lineage tests. |
| Third-party licensing blocks redistribution | Source registry with license field; official-source fallback; pre-ingestion review. |
| Scope expands prematurely to local elections | Federal canonical model first; jurisdiction adapters require separate discovery. |

## 15. First implementation milestone

Before nationwide ingestion, build a vertical slice for 10–12 golden seats:

1. Establish the seat/geography/provenance schema, release model, source registry, and data-quality tests; defer stable public API and post-MVP domain tables.
2. Ingest current seat/member identities and TIGER boundaries.
3. Add ACS observations and FEC summaries.
4. Add one certified election-result path and an explicit unavailable/refusal path. Validate modeled-result invariants with a synthetic fixture; do not put a modeled value in the canonical release until a source-locked overlay reconciles.
5. Implement transient address lookup.
6. Publish browse/profile/source pages.
7. Exercise future scoring and evidence shapes only through offline fixtures; publish neither.
8. Verify privacy through code tests, deployment configuration audits, vendor review, and a production canary plan.
9. Verify provenance, rollback, and accessibility acceptance criteria.

Only then expand state by state and source by source to nationwide coverage.
