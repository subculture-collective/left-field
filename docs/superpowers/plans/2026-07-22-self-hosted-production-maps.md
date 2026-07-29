# Self-Hosted Production Maps Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Recommended path:
> dispatch a fresh subagent per task, review each result with `review-quality`,
> then continue. For complex multi-agent splits, use
> `parallel-feature-development`, `team-composition-patterns`, and
> `team-communication-protocols`. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Build a reproducible, secure, observable Ubuntu 24.04 LTS self-hosted production platform for the existing application, then collect the production storage-retention evidence needed to stage a data publication and eventually R4 maps. This plan does not authorize publication or make R4 public.

**Architecture:** Use three independently failed hosts/domains before broad launch: a web/operations host running Nginx, the non-root application container, and operations tooling; a private PostgreSQL 16/PostGIS 3.4 host; and a separate-domain MinIO S3-compatible object/backup host with immutable versioned storage and offsite replication. Docker Compose on one host is permitted only for a non-public staging environment. Nginx terminates ACME TLS and proxies only to loopback application ports. Ansible is the only deployment mechanism, systemd owns maintenance, and CI promotes immutable image digests through staging before production.

**Tech Stack:** Ubuntu 24.04 LTS, Docker Engine/Compose plugin, Nginx, Certbot ACME, PostgreSQL 16/PostGIS 3.4, MinIO, pgBackRest (or WAL-G only if the decision record selects it), Ansible, systemd, nftables/UFW, OpenSSH, Prometheus, Grafana, Loki, Alertmanager, GitHub Actions, Hadolint, ShellCheck, and the existing Next.js 16/TypeScript application.

---

## Scope, non-negotiable decisions, and launch boundary

- Do not run live-server commands, create cloud accounts, change DNS, publish data, or promote R4 while implementing this plan. All commands below are repository/CI/staging commands unless a later reviewed runbook explicitly marks them as a live, approved operator action.
- Production baseline is **Ubuntu 24.04 LTS**. Pin package/image versions and deploy application images by immutable OCI digest, never a mutable tag.
- Broad production launch requires all three failure domains/hosts: `web-ops`, `postgres`, and `object-backup`. The database is private and accepts only the web/ops host plus the approved backup/monitoring path; MinIO is in a distinct failure domain and replicates offsite. A single-host Compose topology is staging-only and must be rejected by the production environment verifier.
- The `web-ops` role is intentionally combined only for this initial topology. It must not expose PostgreSQL, MinIO, Grafana, Prometheus, Loki, Alertmanager, Docker, or the application directly to the Internet. Nginx exposes only TCP 80/443; port 80 stays available for ACME until DNS/HTTP validation succeeds, then redirects to HTTPS.
- Build application containers as non-root, read-only where feasible, with dropped capabilities, `no-new-privileges`, health checks, resource limits, and no secrets baked into layers. Docker socket access is never granted to the application container.
- Use unique, least-privilege PostgreSQL roles and independently generated credentials for web reads, map reader, raw writer/verifier, ingest, release preflight, release operator, migrations, backup, monitoring, correction intake/review/redaction/maintenance, and address lookup/maintenance. Web gets only `WEB_DATABASE_URL` plus map-read credentials; correction/address are isolated service jobs/routes. Store production secrets as root-owned files loaded by systemd credentials; never commit them, print them, place them in Compose environment blocks, or put them on a process command line.
- Backups must provide continuous WAL archiving plus scheduled base backups and documented, tested PITR. The implementation must select **one** of pgBackRest or WAL-G before coding backup automation; the default recommendation is pgBackRest because it supports PostgreSQL 16 and an S3 repository. The choice is an explicit RPO/RTO gate, not an implicit default.
- Observability must deploy Prometheus, Grafana, Loki, and Alertmanager (or a documented exact minimal equivalent with scrape, dashboard, durable sanitized logs, routing, and paging semantics). Logs are structured and sanitized: no connection strings, authorization headers, cookies, raw addresses, raw receipts, object credentials, database credentials, or request bodies.
- MinIO map/release buckets require versioning, object lock, a retention mode/period approved for the release policy, delete denial for runtime and application identities, and an offsite replication target with corresponding retention. Production evidence must prove version IDs, retention, delete denial, and replication, not merely a local mock.
- Deployment is staged: CI builds/scans/tests an image, pushes and records its digest, deploys that exact digest to staging, runs health/map smoke and restore evidence, then allows a separately approved production deployment. Rollback is an Ansible-mediated switch to a previously recorded digest; it never means database schema downgrade or data-release mutation.
- Existing application lifecycle evidence remains authoritative: R4 is blocked until a publishable R3 exists and the exact map finalizer closure has **441/441 map artifacts/receipts**, plus production object-retention/runtime-credential evidence. The current repository evidence says R3 and R4 are not publishable; this infrastructure work must not weaken that gate.

## Explicit BLOCKED input gates

Do not substitute fake values, `.example` values, or unreviewed defaults. Record each received input, owner, date, and approval in the decision record; leave its gate unchecked otherwise.

- [ ] **BLOCKED — server IPs and access:** obtain the three Ubuntu 24.04 LTS host names, public/private IPs, provider consoles, break-glass procedure, initial named SSH administrators and their public keys, and confirmation that the hosts are separate failure domains.
- [ ] **BLOCKED — domain and DNS:** obtain the production domain names, authoritative DNS access, A/AAAA records for the public Nginx host, ACME contact, and DNS change approval. Do not request certificates or force HTTPS before DNS and HTTP reachability are proven.
- [ ] **BLOCKED — alert delivery:** obtain the monitored alert email/on-call destination, escalation owner, test-message approval, and retention/access policy for the receiver.
- [ ] **BLOCKED — three hosts:** confirm a web/ops host, a private PostgreSQL 16/PostGIS 3.4 host, and a separate-domain MinIO/backup host with offsite replication capacity. One-host Compose evidence cannot satisfy this gate.
- [ ] **BLOCKED — storage and backup credentials:** obtain approved MinIO administrative bootstrap access, separate runtime/backup/replication identity material, offsite replication target credentials, encryption/KMS decision, bucket retention policy, and a secret-delivery channel for root-readable systemd credential files.
- [ ] **BLOCKED — RPO/RTO:** the service owner must choose maximum data loss (RPO), restoration target (RTO), backup frequency, WAL retention, base-backup retention, restore-test cadence, and acceptable restore environment/cost. The plan must stop rather than infer these values.
- [ ] **BLOCKED — delivery authority/capacity:** obtain OCI registry namespace/credentials, GitHub protected-environment owners, deploy-runner network/SSH authorization, capacity and traffic forecast, SLO/error-budget owner, and raw-store writer/verifier credentials.

## Proposed repository layout

- Create `Dockerfile` and `.dockerignore` — reproducible multi-stage non-root web image and constrained build context.
- Create `deploy/README.md`, `deploy/env/production.env.schema`, `deploy/scripts/verify-production-env.sh`, `deploy/scripts/deploy.sh`, `deploy/scripts/rollback.sh`, `deploy/scripts/restore-drill.sh`, and `deploy/scripts/lib/common.sh` — documented, ShellCheck-tested local/CI orchestration that refuses unresolved gates.
- Create `deploy/compose/production.compose.yml`, `deploy/compose/staging.compose.yml`, `deploy/nginx/dsa-seats.conf`, and `deploy/nginx/snippets/security-headers.conf` — production web topology and explicitly non-production one-host staging topology.
- Create `deploy/systemd/dsa-seats-backup.service`, `deploy/systemd/dsa-seats-backup.timer`, `deploy/systemd/dsa-seats-restore-drill.service`, `deploy/systemd/dsa-seats-restore-drill.timer`, `deploy/systemd/dsa-seats-maintenance.service`, and `deploy/systemd/dsa-seats-maintenance.timer` — credential-file-loaded, journaled maintenance.
- Create `deploy/postgres/pgbackrest.conf`, `deploy/postgres/backup.env.schema`, `deploy/postgres/backup-verify.sh`, and `deploy/postgres/restore-verify.sql` — the selected backup/PITR implementation and its assertions. If the approved decision selects WAL-G, create equivalent `deploy/postgres/walg.env.schema`, `deploy/postgres/walg-backup.sh`, and `deploy/postgres/walg-restore-verify.sh` instead and update all references in this plan/runbooks in the same commit.
- Create `deploy/minio/policies/map-reader.json`, `deploy/minio/policies/raw-writer-verifier.json`, `deploy/minio/policies/backup-writer.json`, `deploy/minio/policies/replication.json`, `deploy/minio/bootstrap.sh`, and `deploy/minio/verify-retention.sh` — least-privilege policies, versioned object-lock bootstrap, delete-denial and replication verification.
- Create `deploy/observability/prometheus.yml`, `deploy/observability/alertmanager.yml`, `deploy/observability/loki-config.yml`, `deploy/observability/grafana/provisioning/datasources/datasource.yml`, `deploy/observability/grafana/provisioning/dashboards/dashboards.yml`, `deploy/observability/grafana/dashboards/production-overview.json`, and `deploy/observability/alerts/production-rules.yml`.
- Create `deploy/ansible/ansible.cfg`, `deploy/ansible/inventory/production/hosts.yml`, `deploy/ansible/inventory/staging/hosts.yml`, `deploy/ansible/group_vars/all/main.yml`, `deploy/ansible/group_vars/production/main.yml`, `deploy/ansible/group_vars/staging/main.yml`, `deploy/ansible/playbooks/preflight.yml`, `deploy/ansible/playbooks/bootstrap.yml`, `deploy/ansible/playbooks/deploy.yml`, `deploy/ansible/playbooks/rollback.yml`, `deploy/ansible/playbooks/restore-drill.yml`, and `deploy/ansible/playbooks/verify.yml`.
- Create roles under `deploy/ansible/roles/{base_hardening,docker_host,web_ops,postgres,minio_backup,observability,backup,app_deploy,maintenance,verify}/` with `defaults/main.yml`, `tasks/main.yml`, `handlers/main.yml` where needed, and role-specific templates/files. Do not put credentials in inventory, group vars, role defaults, or templates.
- Create `.github/workflows/ci.yml`, `.github/workflows/container.yml`, `.github/workflows/deploy-staging.yml`, and `.github/workflows/deploy-production.yml` — PR validation, digest build, protected staging deployment, and approval-gated production deployment using GitHub environments.
- Create tests under `deploy/tests/` for Docker, shell, Compose, Ansible, MinIO policy integration, restore drill, and map R4 smoke; create `docs/operations/self-hosted-production-runbook.md`, `docs/operations/backup-and-restore.md`, `docs/operations/incident-and-rollback.md`, `docs/operations/r4-production-evidence.md`, and `docs/decisions/2026-07-22-self-hosted-production.md`.

## Task 1: Record decisions and refuse unsafe topology

**Files:** Create `docs/decisions/2026-07-22-self-hosted-production.md`, `deploy/env/production.env.schema`, `deploy/scripts/verify-production-env.sh`, `deploy/tests/verify-production-env.test.sh`.

- [ ] **Step 1: Write failing verifier tests.** Cover missing each BLOCKED input, repeated host/IP/failure-domain identity, a production inventory containing one host, unencrypted/empty credential references, mutable image tags, and absent selected backup engine/RPO/RTO. Cover a valid three-host fixture without real credentials.
- [ ] **Step 2: Implement the decision record and verifier.** The record must name owners and acceptance evidence for every BLOCKED item, choose pgBackRest versus WAL-G only after approval, and state that R3/R4 publication is outside this deployment. The verifier accepts paths/identifiers but never secret values; production fails closed while staging may explicitly declare `single_host_staging=true`.
- [ ] **Step 3: Run the local gate.** Run: `bash deploy/tests/verify-production-env.test.sh && bash deploy/scripts/verify-production-env.sh --fixture deploy/tests/fixtures/valid-production.env`.

  Expected: tests pass and the fixture prints `production environment verification: pass`; no network connection is made.
- [ ] **Step 4: Commit the safety contract.** `git add docs/decisions deploy/env deploy/scripts deploy/tests && git commit -m "docs: define self-hosted production gates"`.

## Task 2: Build a hardened, digest-addressable application image

**Files:** Create `Dockerfile`, `.dockerignore`, `deploy/tests/dockerfile.test.sh`; modify `package.json` only if a test script is needed.

- [ ] **Step 1: Write Dockerfile assertions first.** Assert multi-stage build, `npm ci`, production dependency output, numeric non-root `USER`, no copied `.env`/Git/node_modules, `NEXT_TELEMETRY_DISABLED=1`, exposed application port, and an HTTP health check that does not reveal secrets.
- [ ] **Step 2: Implement the image.** Use pinned base-image digests selected by CI, retain only runtime assets, run as a non-root UID/GID, and document required runtime writable paths. Do not add database or object-store credentials to build args, labels, or layers.
- [ ] **Step 3: Validate locally.** Run: `hadolint Dockerfile && docker build --pull --tag dsa-seats:test . && docker inspect dsa-seats:test --format '{{.Config.User}}'`.

  Expected: Hadolint exits zero, the build succeeds, and inspect returns a non-root numeric user (not `root` or empty).
- [ ] **Step 4: Commit image hardening.** `git add Dockerfile .dockerignore deploy/tests package.json && git commit -m "build: add nonroot production image"`.

## Task 3: Define staging and production Compose/Nginx boundaries

**Files:** Create `deploy/compose/production.compose.yml`, `deploy/compose/staging.compose.yml`, `deploy/nginx/dsa-seats.conf`, `deploy/nginx/snippets/security-headers.conf`, `deploy/tests/compose.test.sh`, `deploy/tests/nginx.test.sh`.

- [ ] **Step 1: Write configuration tests.** Production must contain only the web application and approved local observability sidecars, bind the app to `127.0.0.1`, use `${APP_IMAGE_DIGEST:?required}`, `read_only`, dropped capabilities, `no-new-privileges`, health checks, restart policy, and root-owned `env_file`/credential mounts. It must not define PostgreSQL or MinIO services. Staging must visibly be labeled non-production and may use one-host dependencies. Nginx tests must allow ACME challenge and HTTP before redirect activation, then require a TLS-only proxy, HSTS only after HTTPS is validated, trusted proxy rules, size/time limits, security headers, and sanitized access-log format.
- [ ] **Step 2: Implement Compose and Nginx.** Parameterize only non-secret identifiers; use systemd `LoadCredential=`-materialized files for secrets. Include separate Nginx configurations/mode variable so the runbook can prove DNS/HTTP first and flip redirect only after certificate issuance and HTTPS health verification.
- [ ] **Step 3: Validate rendering.** Run: `docker compose --env-file deploy/tests/fixtures/compose.env -f deploy/compose/production.compose.yml config --quiet && docker compose --env-file deploy/tests/fixtures/compose.env -f deploy/compose/staging.compose.yml config --quiet && nginx -t -c "$PWD/deploy/tests/fixtures/nginx.conf"`.

  Expected: both Compose files render with no unresolved variables; Nginx reports syntax is ok and test is successful. No listener is started.
- [ ] **Step 4: Commit topology boundary.** `git add deploy/compose deploy/nginx deploy/tests && git commit -m "deploy: add staged web and nginx topology"`.

## Task 4: Automate safe host bootstrap with Ansible

**Files:** Create the `deploy/ansible/` inventory, playbooks, and roles listed above; create `deploy/tests/ansible.test.sh`.

- [ ] **Step 1: Define inventory and role tests.** Assert the production inventory has exactly the `web_ops`, `postgres`, and `minio_backup` groups with distinct host/failure-domain variables; no secrets in tracked YAML; database and object roles have no public ingress; application role never gains Docker socket or root container privileges; and distinct map-reader, raw-writer/verifier, correction intake/review/redaction/maintenance, and address lookup/maintenance principals cannot cross-read or mutate release data.
- [ ] **Step 2: Implement `preflight.yml` before hardening.** It validates Ubuntu 24.04, root/sudo access, inventory topology, free disk/memory thresholds, DNS input presence, time synchronization, an existing non-root SSH administrator, and a recorded second SSH session test. It changes nothing.
- [ ] **Step 3: Implement safe bootstrap order.** Create an admin account/key and verify a second SSH session using that key **before** changing SSH/firewall settings. Configure `sshd` to prohibit root/password authentication only after verification. Configure UFW/nftables default deny, SSH from approved admin CIDRs, web 80/443 only on `web_ops`, and private inter-host ports only from exact inventory IPs. Keep a console/break-glass recovery section in the runbook.
- [ ] **Step 4: Configure roles.** Install pinned Docker/Compose only on `web_ops`; PostgreSQL 16/PostGIS 3.4 only on `postgres`; MinIO only on `minio_backup`; create root-owned `/etc/dsa-seats/credentials` directories (`0700`) and credential files (`0600`); configure the distinct DB/object principals, TLS, `pg_hba.conf`, and local-only/protected service binding. Approved migration-owner jobs apply `0006` before the finance image and `0007` before the dark correction image; each migration is backward-compatible with the prior image. Use Ansible Vault or CI secret injection only for untracked secret material.
- [ ] **Step 5: Validate without a server.** Run: `ansible-playbook -i deploy/ansible/inventory/staging/hosts.yml deploy/ansible/playbooks/preflight.yml --syntax-check && ansible-playbook -i deploy/ansible/inventory/production/hosts.yml deploy/ansible/playbooks/deploy.yml --syntax-check && ansible-lint deploy/ansible`.

  Expected: syntax checks and lint exit zero; no SSH connection occurs because `--syntax-check` is used.
- [ ] **Step 6: Commit automation.** `git add deploy/ansible deploy/tests && git commit -m "deploy: provision separated production hosts"`.

## Task 5: Add immutable MinIO retention and offsite evidence

**Files:** Create `deploy/minio/policies/*.json`, `deploy/minio/bootstrap.sh`, `deploy/minio/verify-retention.sh`, `deploy/tests/minio-policy.integration.sh`, `docs/operations/r4-production-evidence.md`.

- [ ] **Step 1: Write policy integration tests.** With disposable MinIO containers only, assert bucket versioning and object lock are enabled before writes; map reader can `GetObject` only for published map/release prefixes; raw writer/verifier has only required raw prefixes; neither can delete/version-delete; backup can write only backup prefixes; replication has only replication permissions; delete attempts receive AccessDenied; a retained version exposes VersionId and retention metadata; and a replica receives the object/version according to the selected replication rule.
- [ ] **Step 2: Implement bootstrap and verification.** Make bootstrap idempotent and require root-provided credential files, selected retention duration/mode, approved bucket names, and replication target. Do not permit a policy that grants `s3:DeleteObject`, `s3:DeleteObjectVersion`, or broad administrative actions to application identities. Verification must output sanitized bucket/prefix/version/retention/replication status, never keys or endpoints containing credentials.
- [ ] **Step 3: Document R4 evidence requirements.** Require the production verifier report, MinIO versioning/object-lock result, retained 441 map receipt/version IDs, runtime delete-denial output, offsite replication evidence, and named credential separation before an operator can even request R4 promotion. State again that a publishable R3 and the existing 441/441 map finalizer receipts are independently required.
- [ ] **Step 4: Run disposable integration.** Run: `bash deploy/tests/minio-policy.integration.sh`.

  Expected: test MinIO starts locally, all allow/deny/version/retention/replication assertions pass, cleanup runs, and no production endpoint is contacted.
- [ ] **Step 5: Commit storage controls.** `git add deploy/minio deploy/tests docs/operations/r4-production-evidence.md && git commit -m "deploy: enforce immutable map storage"`.

## Task 6: Implement selected PITR backup and restore drills

**Files:** Create the selected `deploy/postgres/` files and systemd backup/restore units; create `deploy/tests/restore-drill.integration.sh`, `docs/operations/backup-and-restore.md`.

- [ ] **Step 1: Close the RPO/RTO decision gate.** Do not implement schedules until the owner has approved numeric RPO/RTO, WAL/base-backup/retention values, encryption decision, restore target, and cadence. Put the approved values and review dates in the decision record; reject a blank or `TBD` value in the verifier.
- [ ] **Step 1a: Separate retention classes.** Record immutable release/raw/map retention independently from the deletable correction operational-backup class. The latter must use deletion-ledger-driven purge/key destruction and WAL/base-backup/offsite retention that guarantee correction content cannot survive its 30-day maximum, including a restore drill that proves post-deletion content cannot reappear.
- [ ] **Step 2: Write restore drill first.** In disposable PostgreSQL 16/PostGIS 3.4 and S3-compatible containers, create a fixture, take a base backup, write a recognizable later transaction, archive WAL, restore to a timestamp/LSN before and after it, and assert PostGIS extension, schema migrations, published-release read, expected fixture state, and absence/presence of the later transaction as appropriate. Capture elapsed time and fail when it exceeds approved RTO.
- [ ] **Step 3: Implement pgBackRest (or approved WAL-G) and systemd.** Use a dedicated backup DB role and object identity; archive WAL continuously; run scheduled base backups; verify backup metadata; route service logs to journald/Loki without credentials. Use `LoadCredential=`/`EnvironmentFile=` only for root-owned files. Timers use randomized delay and persistent catch-up; restore drills never target production data paths.
- [ ] **Step 4: Run the drill locally.** Run: `bash deploy/tests/restore-drill.integration.sh`.

  Expected: a clean disposable restore passes all SQL assertions, prints sanitized measured RPO/RTO evidence, and removes test containers/volumes.
- [ ] **Step 5: Commit continuity controls.** `git add deploy/postgres deploy/systemd deploy/tests docs/operations/backup-and-restore.md docs/decisions && git commit -m "deploy: add tested postgres pitr backups"`.

## Task 7: Deploy observability and sanitized operational signals

**Files:** Create the observability files listed above; create `deploy/tests/observability.test.sh`, `docs/operations/incident-and-rollback.md`.

- [ ] **Step 1: Write configuration assertions.** Check targets for Nginx, application health/metrics, node/container, PostgreSQL, MinIO, and backup freshness; alerts for endpoint/health failure, certificate expiry, disk pressure, backup/WAL/archive/restore failure, replication lag/failure, object-lock verification failure, and database availability; Alertmanager must have a real receiver identifier gated by the alert-input decision. Reject secret-bearing log fields and high-cardinality release/run/source IDs as metric labels.
- [ ] **Step 2: Implement the stack.** Provision Grafana data sources/dashboard and alert rules through files; keep UI admin bootstrap credentials in root-only credentials; expose no observability UI publicly by default. Configure Loki/journal ingestion and retention according to the approved operational policy. Add a test alert route that is disabled until the recipient gate is approved.
- [ ] **Step 3: Validate.** Run: `docker compose --env-file deploy/tests/fixtures/observability.env -f deploy/compose/staging.compose.yml -f deploy/tests/fixtures/observability.compose.yml config --quiet && bash deploy/tests/observability.test.sh`.

  Expected: rendered config is valid and tests prove required targets/rules/sanitization; no alert is delivered externally.
- [ ] **Step 4: Commit observability.** `git add deploy/observability deploy/tests docs/operations/incident-and-rollback.md && git commit -m "deploy: add production observability"`.

## Task 8: Add digest deployment, rollback, health, and CI environments

**Files:** Create deployment/rollback scripts, `deploy/tests/deploy-scripts.test.sh`, and the four GitHub workflows; modify `.github/workflows/acceptance.yml` only to share safe reusable checks if appropriate.

- [ ] **Step 1: Write script/workflow tests.** Assert deploy accepts only `sha256:<64 hex>` image digests and an approved environment, runs the production verifier before Ansible, records the prior digest, waits for Compose/Nginx/application health, and fails closed. Assert rollback accepts only a recorded prior digest, requires operator confirmation in production, and refuses schema/data rollback. Assert GitHub workflows use protected `staging`/`production` environments, least-privilege permissions, pinned actions by commit SHA, concurrency control, and no secret output.
- [ ] **Step 2: Implement CI sequence.** `ci.yml` runs lint/typecheck/unit tests and new static checks. `container.yml` runs Hadolint, pinned `gitleaks` plus manual-review gate, builds, scans according to approved policy, pushes, and emits the immutable digest artifact; scanner/network failure blocks and a clean scan is not proof of absolute absence. `deploy-staging.yml` consumes that digest, runs staging Ansible/deploy, health checks, Map R4 smoke, storage integration evidence, and restore drill. `deploy-production.yml` requires protected environment approval, every BLOCKED gate/evidence artifact, and deploys the same staged digest.
- [ ] **Step 3: Implement health and map smoke.** Health must check Nginx HTTPS, loopback application readiness, database restricted connectivity, MinIO runtime read of a known non-sensitive artifact, backup freshness, and observability scrape. The map smoke must use only a published release fixture/approved release ID, verify public map route headers/ETag/cache and a sampled artifact receipt, reject candidate access, and explicitly return `BLOCKED` when no publishable R3/R4 exists rather than bypassing lifecycle controls.
- [ ] **Step 4: Validate locally.** Run: `shellcheck deploy/scripts/*.sh deploy/minio/*.sh deploy/postgres/*.sh && bash deploy/tests/deploy-scripts.test.sh && npm run lint && npm run typecheck && npm run test:run -- src/maps/public-map.test.ts src/ingestion/tiger/finalize-maps.test.ts`.

  Expected: ShellCheck and script tests pass; application lint/typecheck/tests pass; map tests preserve the existing candidate isolation and 441-artifact behavior.
- [ ] **Step 5: Commit release delivery.** `git add .github deploy/scripts deploy/tests .github/workflows/acceptance.yml && git commit -m "ci: deploy immutable images through staging"`.

## Task 9: Create approval-gated runbooks and perform staging-only proof

**Files:** Create `docs/operations/self-hosted-production-runbook.md`; modify `docs/operations/release-runbook.md` only to link the new infrastructure/R4 evidence gate; update decision record with completed evidence.

- [ ] **Step 1: Document exact safe ordering.** The runbook must state: obtain all BLOCKED inputs; run repository verifier; run Ansible preflight; establish and test a second SSH session; only then harden SSH/firewall; deploy HTTP Nginx ACME challenge; verify authoritative DNS and HTTP reachability; obtain/verify certificate; only then enable HTTP-to-HTTPS redirect/HSTS; deploy digest to staging; execute health, alert, object-retention, backup, and restore drills; collect evidence; request production approval. Include rollback/incident and console recovery instructions.
- [ ] **Step 2: Define production acceptance checklist.** Require successful syntax/static/integration tests, CI digest provenance, staging digest parity, three-host verifier pass, verified network boundaries, test alert receipt, backup/PITR drill within chosen RPO/RTO, object lock/delete-denial/offsite replication evidence, sanitized log review, and distinct runtime/backup/replication credentials. Any missing item remains BLOCKED.
- [ ] **Step 3: Define the data/R4 handoff.** After platform acceptance, data publication remains a separate release-operator action governed by `docs/operations/release-runbook.md`. R4 requires a publishable R3, normal lifecycle proof, exact 441/441 map artifact/receipt closure, and the production storage-retention/runtime-credential evidence from this plan. Do not create a production R4 merely to test infrastructure.
- [ ] **Step 4: Run final repository verification.** Run: `git diff --check && git diff -- docs/superpowers/plans/2026-07-22-self-hosted-production-maps.md`.

  Expected: `git diff --check` has no output and exits zero; the diff contains only the intended plan/documentation changes at this planning stage.
- [ ] **Step 5: Commit runbooks separately.** `git add docs/operations docs/decisions && git commit -m "docs: add self-hosted production runbook"`.

## Verification matrix

- [ ] Hadolint validates `Dockerfile`; ShellCheck validates every tracked shell script.
- [ ] `ansible-playbook --syntax-check` and `ansible-lint` validate staging and production inventory/playbooks without contacting live hosts.
- [ ] `docker compose config --quiet` validates staging and production rendering; production topology test rejects one-host/database/MinIO exposure.
- [ ] Disposable MinIO integration proves versioning, object lock, retention, runtime delete denial, least privilege, and replication behavior.
- [ ] Disposable PostgreSQL/PostGIS backup integration proves base backup, WAL archive, point-in-time restore, schema/extensions, and measured recovery against approved RPO/RTO.
- [ ] Observability configuration test proves required targets, actionable alerts, protected receiver configuration, and log sanitization rules.
- [ ] Deployment/rollback script tests prove digest-only promotion, health-gated rollout, recorded rollback, and no schema/data rollback.
- [ ] Existing map tests plus the staging map R4 smoke preserve candidate denial, immutable headers/ETag, and the 441/441 receipt requirement; the smoke reports BLOCKED until R3/R4 lifecycle prerequisites exist.
- [ ] CI environments prove the production workflow deploys exactly the digest previously accepted in staging and cannot proceed without protected approval/evidence.

## Execution status

This is a plan only. No infrastructure files, server changes, DNS records, credentials, data publications, or R4 promotions are created by this document. All six BLOCKED input gates remain unresolved until the service owner supplies and approves the required real inputs.
