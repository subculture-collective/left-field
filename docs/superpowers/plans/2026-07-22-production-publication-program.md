# Production Publication Program Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Recommended path:
> dispatch a fresh subagent per task, review each result with `review-quality`,
> then continue. For complex multi-agent splits, use dependency-aware ownership
> and explicit handoffs. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish real nationwide finance, election, and map releases and activate corrections and address lookup on hardened self-hosted Linux without weakening source, privacy, or release gates.

**Architecture:** Work proceeds through irreversible gates: production foundation, R2 finance, R3 elections, R4 maps, corrections, address lookup, then final public acceptance. Every stage produces an immutable reviewed evidence package and can fail closed without changing the published release or enabling a dark feature.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL 16/PostGIS 3.4, Drizzle migrations, S3-compatible immutable object storage, Docker, Ansible, Nginx, systemd, GitHub Actions, Vitest, Playwright, OpenFEC, original election-authority sources, and Census geocoding.

---

## Program constraints

- The source cutoff remains **2026-07-18** unless a new release program explicitly replaces the 541-seat/537-occupied/4-vacant scope.
- Finance coverage has four structural kinds per seat (2,164 rows), but closure is 541 terminal summary dispositions. A coverage row may be `not_collected` unless independently reviewed; every summary is signed and terminal, including resolved `vacancy`, `no_declared_cycle`, `no_authorized_committee`, and `no_report`, which are distinct from unresolved mapping. Do not assume every occupant has FEC candidacy.
- Elections freeze the contest universe to 2020/2024 presidential general contests plus the exact reviewed 2022 Clerk federal inventory. Every item must have approved result closure or a signed unavailable disposition; 158 jurisdiction/year decisions remain the review matrix. Geometry/crosswalk evidence is required only for modeled current-boundary derivation.
- Migrations `0000`–`0005` are immutable. The staged additive sequence is `0006_launch_data_proofs.sql` for finance/elections, followed by `0007_correction_privacy_lifecycle.sql`; neither plan may reuse or reorder those migration numbers.
- Candidate/synthetic data is never described as published. Missing credentials remain `not_collected`, not `source_unavailable` or `license_unavailable`.
- Publication proofs and signatures are immutable operational evidence outside the seven content digests. Candidate/freeze/immutability guards protect them, their hashes bind directly into the preflight fingerprint, and content-table changes still invalidate/recompute the seven digests without circularity.
- `CORRECTION_INTAKE_MODE=disabled` and `ADDRESS_LOOKUP_MODE=disabled` remain the checked-in and production defaults until their signed activation packages pass.
- One-host deployment is staging evidence only. Broad launch requires separate web/operations, database, and immutable-storage failure domains plus offsite backup replication.

## Detailed plans

1. [`2026-07-22-self-hosted-production-maps.md`](./2026-07-22-self-hosted-production-maps.md)
2. [`2026-07-22-real-finance-election-publication.md`](./2026-07-22-real-finance-election-publication.md)
3. [`2026-07-22-correction-address-activation.md`](./2026-07-22-correction-address-activation.md)

## Task 0: Freeze decisions and obtain external inputs

**Files:**
- Create: `data/reviews/launch/scope.json`
- Create: `data/reviews/launch/data-use-review.md`
- Create: `data/reviews/launch/retention-policy.md`
- Create: `data/reviews/launch/credential-attestation.json`
- Create: `docs/deployment/production-inputs.md`

- [ ] **Step 1: Record the approved release scope**

Write canonical `data/reviews/launch/scope.json` with these exact decisions:

```json
{
  "schemaVersion": 1,
  "sourceCutoff": "2026-07-18",
  "seatCount": 541,
  "occupiedSeatCount": 537,
  "vacantSeatCount": 4,
  "financeSubject": "cutoff_active_seat_current_occupant_declared_cycle",
  "financeAggregation": "gross_committee_ytd_no_transfer_netting",
  "signedAmounts": "signed_integer_cents",
  "scheduleAContributorData": "prohibited",
  "electionDecisionCount": 158,
  "electionYears": [2020, 2022, 2024]
}
```

- [ ] **Step 2: Obtain infrastructure inputs**

Record real values in a restricted operator system, and only redacted identifiers in `docs/deployment/production-inputs.md`:

- three Ubuntu 24.04 LTS hosts or equivalent failure domains, deploy-runner network/SSH access, capacity/traffic forecast, and SLO owner;
- host provider, region, IPs, non-root administrator access, and SSH allowlist/VPN;
- production domain, DNS provider access, and ACME/alert email;
- OCI registry/namespace/credentials, GitHub protected-environment owners, and raw-store credentials;
- MinIO/S3 endpoints and buckets for immutable release/raw/map objects, PostgreSQL WAL/backups, and sanitized evidence;
- object-lock retention, delete-denial policy, offsite replication, encryption owners, and a backup-class policy: immutable release/raw/map retention is separate from deletable correction operational backups; deletion ledger/key destruction and backup retention must prevent correction content surviving its 30-day maximum;
- RPO, RTO, secret-store owner, logging/APM inventory, and on-call contacts.

**BLOCKED until supplied:** no production deployment command may run without these values.

- [ ] **Step 3: Obtain data and reviewer inputs**

Required inputs:

- server-side OpenFEC API key and a named API-use owner;
- signed finance legal/data-use disposition for sanitized aggregates;
- exact Clerk 2020/2022/2024 artifacts and original state/territory result, certification, and terms artifacts; official geometry/crosswalk artifacts are required only for cohorts selected for modeled current-boundary derivation;
- named product/data, legal, security, operations, and release reviewers;
- distinct security and operations signing keys for correction/address activation.

**BLOCKED until supplied:** finance/election network acquisition and feature activation remain disabled.

- [ ] **Step 4: Verify no secret entered the repository**

Run:

```bash
gitleaks detect --source . --no-git --redact
git diff --check
git status --short
```

Expected: pinned `gitleaks` plus manual review find no secret; scanner/network failure blocks this gate. This is evidence that no secret was reported, not proof of absolute absence. Only canonical redacted review artifacts are tracked; no URL contains a password, API key, private key, address, or canary marker.

- [ ] **Step 5: Commit the scope freeze**

```bash
git add data/reviews/launch docs/deployment/production-inputs.md
git commit -m "docs: freeze production publication scope"
```

## Task 1: Build the dark production foundation

**Plan:** `2026-07-22-self-hosted-production-maps.md`, Tasks 1–8.

- [ ] **Step 1: Implement and review container, Ansible, network, TLS, credential, backup, object-lock, observability, and deployment automation**

Expected: all services deploy with corrections and address lookup disabled; web receives `WEB_DATABASE_URL` and map-read credentials only. Correction and address are isolated service jobs/routes with least privilege; database and object storage are not publicly reachable.

- [ ] **Step 2: Prove recovery before publication**

Run the linked backup/PITR and object-lock drills.

Expected: restore reaches the selected timestamp, preserves release pointer and role boundaries, and runtime credentials cannot delete or shorten retained objects.

- [ ] **Step 3: Deploy the same immutable image to dark staging and production**

Expected: image digest, migration hashes, redacted configuration hash, and health report match; no public data claim changes.

**BLOCKED until Task 0 infrastructure inputs exist.**

## Task 2: Publish R2 finance

**Plan:** `2026-07-22-real-finance-election-publication.md`, finance tasks.

- [ ] **Step 1: Close finance acquisition, multi-run finalization, mapping, signed-value, receipt, and publication-proof code gaps**

Expected: focused and guarded PostgreSQL tests pass; an incomplete finance proof cannot move the published pointer.

- [ ] **Step 2: Acquire and review the 541-seat finance scope**

Expected: 541 signed terminal summaries: 4 vacancies and, for occupied seats, approved finance or the resolved terminal outcome `no_declared_cycle`, `no_authorized_committee`, or `no_report`; unresolved mapping is zero. Exact candidate/committee closure is required only where applicable, with zero pagination and amendment gaps for collected evidence.

- [ ] **Step 3: Finalize and validate R2**

Required counts: 541 signed terminal finance summary dispositions and 2,164 structural coverage rows; only summaries must close. The other 1,623 coverage rows may be explicit `not_collected` unless independently reviewed; all seven content digests match.

- [ ] **Step 4: Promote, smoke, rollback, and re-promote R2**

Expected: real release-addressed finance profiles and source closure pass; rollback returns to R1; fresh proof re-promotes the same immutable R2.

**BLOCKED until FEC credentials, data-use approval, and independent mapping reviewers exist.**

## Task 3: Publish R3 elections

**Plan:** `2026-07-22-real-finance-election-publication.md`, election tasks.

- [ ] **Step 1: Implement immutable result receipts, production result loading, historical geographies, reconciliation, and election publication proof**

Expected: every approved result lineage is a subset of its decision evidence; missing reconciliation stays unavailable, never fabricated. Geometry/crosswalk evidence is required only for modeled current-boundary derivations; approved original-boundary results and signed unavailable dispositions require none.

- [ ] **Step 2: Review all 158 jurisdiction/year cohorts**

Expected: 51 reviewed 2020, 56 reviewed 2022, and 51 reviewed 2024 decisions; exact Clerk contest inventory locks the result denominator.

- [ ] **Step 3: Finalize and validate R3**

Expected: frozen contest items (2020/2024 presidential general plus exact reviewed 2022 Clerk inventory) each have approved closure or signed unavailable disposition. A signed first failure may leave downstream gates not-assessed; universal geometry and zero downstream unassessed are not required. Geometry/crosswalk is needed only for modeled current-boundary derivation.

- [ ] **Step 4: Promote, smoke, rollback, and re-promote R3**

Expected: certified/modeled/unavailable labels and release-addressed source closure pass; rollback returns to R2; fresh exact proof re-promotes immutable R3.

**BLOCKED until exact authority artifacts, licensing reviews, independent cohort reviewers, and geometry/crosswalk evidence for every selected modeled derivation exist.**

## Task 4: Publish R4 maps

**Plan:** `2026-07-22-self-hosted-production-maps.md`, map tasks.

- [ ] **Step 1: Verify the published R3 predecessor and immutable production store policy**

Expected: versioning/object lock/delete denial are enabled; writer and reader credentials are distinct; policy verifier passes.

- [ ] **Step 2: Finalize exactly 441 district map artifacts**

Expected: 441/441 receipts bind release, geography, object key, VersionId, ETag, byte size, and SHA-256.

- [ ] **Step 3: Promote and smoke R4**

Expected: published and previously published retired maps serve immutable cacheable GeoJSON; candidates and integrity failures return uniform no-store 404.

**BLOCKED until R3 is published and production storage evidence passes.**

## Task 5: Activate corrections

**Plan:** `2026-07-22-correction-address-activation.md`, correction tasks.

- [ ] **Step 1: Implement correction privacy lifecycle and true disabled/canary/enabled modes**

Expected: disabled mode renders no form or client bundle; sensitive content is deletable under narrow privacy authority while non-sensitive audit metadata remains immutable.

- [ ] **Step 2: Operate moderation, retention, cleanup, and restore-deletion drills**

Expected: malicious URLs remain quarantined; deletion meets primary/replica/backup SLAs; restore cannot resurrect redacted content.

- [ ] **Step 3: Verify and sign the correction activation package**

Expected: distinct security and operations signatures bind exact environment, build, migrations, configuration, retention, and applicable correction evidence. Census and address-canary evidence are excluded from the correction package.

- [ ] **Step 4: Activate correction intake and immediately retest the kill switch**

Expected: activation matches the signed revision; kill switch disables intake in at most 60 seconds.

**BLOCKED until two independent approvers and correction-specific retention, deletion, moderation, restore, and kill-switch evidence exist. Address canary or Census evidence is not a correction prerequisite.**

## Task 6: Activate address lookup

**Plan:** `2026-07-22-correction-address-activation.md`, address tasks.

- [ ] **Step 1: Approve Census vendor/egress residual risk and zero-persistence controls**

Expected: no address, coordinates, full Census URL, bind values, or political-interest association appears in logs, APM, database telemetry, backups, or support exports.

- [ ] **Step 2: Operate maintenance, HMAC rotation, and dark-host tests**

Expected: expired buckets are removed; direct ingress fails; trusted headers are overwritten; rotation follows disable → drain two hours → rotate/revoke.

- [ ] **Step 3: Execute the separately authorized address-canary package, then expiry searches**

Expected: success/error/abort/rate-limit/kill paths pass; forbidden-marker searches are empty immediately, after 14-day log expiry, and after 30-day backup expiry.

- [ ] **Step 4: After 14/30-day evidence, verify a new address-enable package and activate its exact approved revision**

Expected: runtime gate is root-controlled `0640` with a dedicated read-only GID, read-only bind/systemd credential access, and a latched kill override that cannot re-enable from an unchanged manifest; kill switch disables lookup in at most 60 seconds.

**BLOCKED until Census disposition, independent approvers, and 30-day expiry evidence exist.**

## Task 7: Run final public acceptance

**Files:**
- Create: `docs/reviews/production-publication-acceptance.md`
- Modify: `docs/data/source-coverage.md`
- Modify: `docs/operations/release-runbook.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Run repository and production gates**

```bash
npm run test:acceptance
npm audit --audit-level=low
```

Expected: no skipped required suite, no reported advisory, no schema drift, and all real release proofs replay from immutable storage. `npm audit --audit-level=low` network/audit failure blocks; a clean result is not proof of absolute absence of vulnerabilities.

- [ ] **Step 2: Run production health, restore, storage, deployment, correction, and address drills**

Expected: durable telemetry is observed; backups restore; storage retention holds; release/application rollback works; both feature kill switches meet SLA.

- [ ] **Step 3: Reconcile every product criterion**

Record each criterion as `pass`, `fail`, or `blocked`. Never aggregate a blocked item to green. Manual keyboard/focus/contrast/screen-reader review is required; Axe is only automated smoke evidence.

- [ ] **Step 4: Request final independent reviews**

Required reviewers: data integrity, security/privacy, UI/accessibility, infrastructure/SRE, and architecture/merge readiness.

- [ ] **Step 5: Approve or reject launch**

Launch is approved only if every stage above is `pass`, every signed package matches the deployed revision, production telemetry is observed, and no external blocker remains. Otherwise preserve the last safe published release and keep blocked features disabled.

## Self-review

- **Spec coverage:** finance, elections, maps, corrections, address, self-hosting, evidence, rollback, and final launch are each owned by a gate and detailed subplan.
- **Failure behavior:** missing inputs never become fabricated availability; publication and activation fail closed.
- **Type/contract consistency:** release order is R1 → R2 finance → R3 elections → R4 maps; correction/address activation is independent of immutable factual-release data but occurs after R4 by program policy.
- **No secret handling:** plans record identifiers and hashes only; credentials and canary plaintext stay in approved secret/evidence systems.
