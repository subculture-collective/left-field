# Phase 1 address lookup engineering evidence

Status: implementation evidence is checked in; shared deployment and activation are blocked.

## Current checked-in evidence

- The retained, source-locked `census-geocoder-contract-v1.json` fixes the Census HTTPS origin/path, `Public_AR_ACS2025` (`8`) benchmark, `ACS2025_ACS2025` (`825`) vintage, and `States,119th Congressional Districts` layers. It contains no submitted address, coordinate, or test marker.
- The source-locked v1 and v2 sanitized decision corpora drive the shared resolver and strict `AddressResolution` decision contract in focused tests. V2 preserves all v1 outcomes and adds exactly the six matched zero-Senate cases for DC, PR, GU, VI, AS, and MP.
- The adapter exports the frozen values used by the contract test and retains fixed-origin, redirect-rejection, no-store, content-type, and bounded-response behavior.
- The checked-in route is dark/disabled and the form is enabled-only. Merging these mechanisms is not activation.

## Validation evidence

- Fresh migrations `0000` through `0005` applied to `dsa_seats_task12_acceptance_test`; Drizzle reports 70 tables and no schema drift.
- All 34 guarded PostgreSQL scenarios passed in about 524 seconds. Task 12 evidence includes distinct lookup/maintenance principals, current-published-only RLS, atomic quotas, canary replay and future-skew handling, cleanup, queued-checkout and active-query cancellation with no quota/nonce writes, territory policy, and unchanged manifest/gate/seven-domain digests.
- The non-guarded suite passed 497 tests across 66 files; the same 34 guarded cases were skipped only in that command and passed above.
- Strict TypeScript, ESLint (zero errors; one pre-existing unused-variable warning), the Next production build, 96-entry source-lock verification, zero-vulnerability npm audit, Compose validation, Drizzle no-drift generation, and diff checks passed.
- Disabled desktop/mobile browser and Axe checks passed 4/4. An injected non-production enabled configuration with intercepted same-origin API calls passed 6/6 desktop/mobile functional, finite-error, and Axe checks. No real address, coordinate, Census request, canary, or shared enabled deployment was used.
- Oracle, security, and design reviews approved the dark artifact. Security approval retains only the external activation blockers below.

## External activation blockers

The privacy gate at `docs/deployment/address-lookup-privacy-gate.md` remains fully unchecked. No shared deployment configuration, environment-specific two-person approval, telemetry/redaction evidence, trusted edge and egress controls, Census processor review/disclosure approval, shared rate-limit operation/cleanup evidence, retention evidence, or controlled canary evidence has been supplied. The dark route and enabled-only form must not be deployed or activated in a shared environment until the complete gate is approved.
