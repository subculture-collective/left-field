# Self-hosted production safety contract

**Status:** blocked pending named-owner approval.  This is an offline contract,
not authorization to provision hosts, change DNS, deploy, or publish R3/R4.

## Required approved inputs

An operator must provide a fixture containing identifiers and credential-file
paths only.  It must never contain a password, token, private key, connection
string, or credential-bearing URL.  `deploy/env/production.env.schema` is the
authoritative ordered complete field list: it uses one uppercase key per line
(with blank lines and `#` comments allowed), is parsed without evaluation, and
is consumed by `deploy/scripts/verify-production-env.sh`, the offline gate.

The required inputs are: Ubuntu 24.04 host/IP/failure-domain identifiers for
exactly one each of `web_ops`, `postgres`, and `minio_backup`; registry
namespace and immutable image digest; protected-environment owners and deploy
runner access identifier; capacity/traffic and SLO owners; a selected and
approved `pgbackrest` or `walg` backup engine; numeric RPO, RTO, and retention;
separate `immutable` release, raw, and map classes and a `deletable`
correction-backup class with retention
(correction is at most 30 days); an offsite target identifier; raw writer and
verifier, map reader, and all listed database-principal identifiers; and domain,
DNS, ACME, and alert owners.  Each blocked gate needs its owner, ISO-8601 date,
and approval identifier.

Credential references must be absolute `/etc/dsa-seats/credentials/...` paths
and `CREDENTIAL_DELIVERY` must be `systemd_loadcredential_root_owned`; their
contents are supplied later through the approved secret-delivery channel.

## Acceptance evidence and owners

Before a production action, the named owner for each `BLOCKER_*_OWNER` field
records the corresponding approval identifier and date in the fixture, then
attaches: provider/console and separate-domain confirmation (server access and
three hosts); authoritative DNS and ACME approval (domain/DNS); approved
receiver and escalation test authorization (alerts); approved storage,
encryption, retention, and offsite target (storage); approved RPO/RTO, backup
engine, cadence, and restore target (continuity); and protected-environment,
runner, capacity, and SLO approval (delivery).  The verifier only confirms that
these identifiers are present and well formed; it cannot establish their truth.

The accepted production topology is three distinct host, IP, and failure-domain
identifiers for web/ops, private PostgreSQL, and MinIO/backup.  A one-host
configuration is only allowed when `ENVIRONMENT=staging` and
`SINGLE_HOST_STAGING=true`, in which case all three identifiers in each category
must be identical; all other configurations require them to be pairwise
distinct.  Production images must be `sha256:` digests, never tags.

No backup engine, infrastructure endpoint, owner, approval, or credential has
been supplied by this decision.  The valid fixture is deliberately synthetic
and is test data only.  R3/R4 publication remains outside this deployment
contract and retains all existing lifecycle and 441/441 evidence gates.
