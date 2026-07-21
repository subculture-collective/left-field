# Phase 1 R4 map engineering evidence

Status: engineering mechanism complete and approved; production R4 publication blocked.

## Scope boundary

Task 10 adds deterministic, release-addressed district map engineering without creating or promoting a production R4. The current published release remains unchanged. Task 9 did not produce a publishable R3, so map lifecycle evidence is restricted to disposable synthetic releases.

The public artifact contains only the district boundary. It contains no address, lookup coordinate, basemap, tile request, geocoder result, or third-party telemetry.

## Deterministic simplification

The retained 2025 TIGER/CD119 district layer is processed as one 441-feature topology with pinned `mapshaper@0.6.113`, Douglas–Peucker at 25 metres, `keep-shapes`, and six-decimal output precision. Independent validation preserves exact GEOID, feature, polygon, ring, winding-role, and 1,169 adjacency-pair closure and enforces a 150 metre post-rounding symmetric boundary-error cap.

Pinned retained-source results from two identical runs:

- input bytes: 93,269,640;
- input vertices: 4,049,004;
- output vertices: 452,334;
- vertex reduction: 3,596,670;
- maximum measured symmetric error: 39.84855589476526 metres;
- ordered output SHA-256: `98abc93f62a0af3f30351ec52c09c7d8f2cddb9ea7653e92e30b79c48ee5f1ff`.

The finalizer and restart verifier independently replay the pinned transformation from the exact source bytes instead of trusting caller-supplied geometry or metrics.

## Storage and release model

Migration `0003_steep_kid_colt.sql` adds exact map artifact receipts, a short-lived single-use lifecycle-preflight capability, and distinct web, ingest, preflight, and operator roles. Map objects use `maps/{releaseId}/{geographyId}.geojson`. Local storage is development-only and uses atomic no-clobber writes; production S3 requires versioning and exact VersionId, ETag, byte-size, and SHA-256 reads.

The candidate finalizer persists exactly 441 output snapshots, geometry artifacts, map artifacts, map inputs, derivations, derivation inputs, receipts, and one complete 441/441 maps coverage record. Derived outputs point to the sole original TIGER snapshot. All seven release domains are re-digested and the candidate remains unpublished.

Public serving accepts only current published or previously published retired releases, validates canonical property-free district MultiPolygon bytes and persisted receipts, and returns a strong SHA ETag with one-year immutable caching. Candidate and integrity failures are uniform no-store 404 responses.

## PostgreSQL mechanism evidence

The guarded test `finalizes Task 10 maps atomically from the exact official CD119 layer` uses fresh migrations 0000–0003, a synthetic mapless v2 predecessor/candidate, the real simplifier, `LocalMapArtifactStore`, and the production finalizer/verifier.

Verified so far:

- exact 441-map closure and valid nonempty PostGIS MultiPolygons;
- atomic database persistence with no database leakage after fault-injected partial immutable writes;
- same-byte orphan adoption on retry;
- source/output checksum rejection;
- all seven release digests and nationwide gate;
- source release unchanged and target candidate-only;
- restart idempotency and concurrent shared verification;
- different-layer retry and persisted tampering rejection;
- map publication rejected without the required Task 9 predecessor proof.

The targeted scenario passes after the final lifecycle changes on a fresh 0000–0003 disposable database. It also proves safe initial mapless publication before constructing the map candidate. Fresh migration and restricted-login smoke separately prove web candidate isolation, candidate-only ingest writes, preflight-only proof issuance, operator-only transition consumption, ordinary promotion, and proof-free direct-predecessor rollback. Drizzle reports 64 tables and no schema drift.

Final validation passed 32/32 guarded PostgreSQL scenarios on a fresh database (about 735 seconds) and 426/426 non-guarded tests across 57 files; the 32 environment-gated cases skipped by the non-guarded command are the same cases proven separately. Strict TypeScript, ESLint (one pre-existing warning), Next production build, 94-entry source-lock verification, zero-vulnerability audit, Compose validation, 64-table Drizzle no-drift generation, and diff checks passed. Final Oracle and security code-boundary review approved the split-capability design after a two-connection race regression proved proof issuance freezes a waiting candidate writer before mutation. A final review also verified that the destructive E2E seed accepts only a dedicated Task10 directory, ingestion DML excludes PostGIS/system tables, and publication reuses the route's canonical GeoJSON validator.

The browser gate uses a dedicated disposable `_test` database and local map root. It exercises the real 441-map finalizer, then uses an explicit test-only migration-owner publication bypass solely because the intentionally absent Task-9 proof blocks real R4 publication. Desktop Chromium and Pixel-5 Chromium passed six checks: release-addressed route bytes/headers/ETag/cache, static noninteractive SVG and semantic ledger, keyboard-accessible mobile data tables, zero console errors, and Axe WCAG A/AA. Browser testing exposed and fixed an ambiguous map-profile SQL parameter, missing application icon, and two keyboard-inaccessible mobile scroll regions.

## Production blockers

- No publishable, fully reviewed Task 9 R3 predecessor exists.
- Production map object storage, version-retention/delete-denial policy, and separate runtime credentials are deployment requirements, not established by local mechanism tests.
- Release preflight/operator separation and restricted-role evidence are implemented and code-boundary approved; production still requires separately provisioned credentials.
- Production deployment still needs real object retention controls and named runtime credentials; local restricted-role evidence does not establish those external controls.

No production R4 was created or promoted.
