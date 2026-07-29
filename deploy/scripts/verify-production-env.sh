#!/usr/bin/env bash
# Offline-only production safety gate. It never evaluates fixture contents.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCHEMA_PATH="$SCRIPT_DIR/../env/production.env.schema"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

fail() { printf '%s\n' "production environment verification: fail ($1)" >&2; exit 1; }

[[ $# -eq 2 && "$1" == "--fixture" ]] || fail E01
load_required_schema "$SCHEMA_PATH" || fail E02
load_identifier_fixture "$2" || fail E02
shopt -s nocasematch
for key in "${!FIXTURE_VALUES[@]}"; do
  [[ -n "${REQUIRED_KEY_SET[$key]+present}" ]] || fail E03
  value="$(fixture_value "$key")"
  [[ ! "$value" =~ [[:space:]] ]] || fail E04
  [[ ! "$value" =~ (password|secret|token|api[_-]?key|authorization|bearer|akia|-----begin) ]] || fail E05
  [[ ! "$value" =~ ://[^/[:space:]]*@ ]] || fail E05
done
for key in "${REQUIRED_KEYS[@]}"; do
  value="$(fixture_value "$key" || true)"
  [[ -n "$value" ]] || fail E03
  [[ ! "$value" =~ (^|[-_.])([Ee][Xx][Aa][Mm][Pp][Ll][Ee]|[Tt][Bb][Dd])($|[-_.]) ]] || fail E04
done
shopt -u nocasematch

environment="$(fixture_value ENVIRONMENT)"
[[ "$environment" == production || "$environment" == staging ]] || fail E06
[[ "$(fixture_value OS_RELEASE)" == ubuntu-24.04 ]] || fail E06
if [[ "$environment" == production ]]; then
  [[ "$(fixture_value SINGLE_HOST_STAGING)" == false ]] || fail E07
else
  [[ "$(fixture_value SINGLE_HOST_STAGING)" == true || "$(fixture_value SINGLE_HOST_STAGING)" == false ]] || fail E06
fi

for key in WEB_OPS_HOST POSTGRES_HOST MINIO_BACKUP_HOST; do
  [[ "$(fixture_value "$key")" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$ ]] || fail E06
done
for key in WEB_OPS_FAILURE_DOMAIN POSTGRES_FAILURE_DOMAIN MINIO_BACKUP_FAILURE_DOMAIN; do
  [[ "$(fixture_value "$key")" =~ ^fd-[A-Za-z0-9]([A-Za-z0-9.-]{0,250}[A-Za-z0-9])?$ ]] || fail E06
done
for key in WEB_OPS_IP POSTGRES_IP MINIO_BACKUP_IP; do
  ip="$(fixture_value "$key")"
  IFS=. read -r -a octets <<<"$ip"
  [[ ${#octets[@]} -eq 4 ]] || fail E06
  for octet in "${octets[@]}"; do
    [[ "$octet" =~ ^(0|[1-9][0-9]{0,2})$ && $((10#$octet)) -le 255 ]] || fail E06
  done
done

[[ "$(fixture_value APP_IMAGE_DIGEST)" =~ ^sha256:[a-f0-9]{64}$ ]] || fail E08
[[ "$(fixture_value BACKUP_ENGINE)" == pgbackrest || "$(fixture_value BACKUP_ENGINE)" == walg ]] || fail E09
for key in RPO_MINUTES RTO_MINUTES RELEASE_RETENTION_DAYS RAW_RETENTION_DAYS MAP_RETENTION_DAYS; do
  [[ "$(fixture_value "$key")" =~ ^[1-9][0-9]*$ ]] || fail E10
done
[[ "$(fixture_value CORRECTION_BACKUP_RETENTION_DAYS)" =~ ^([1-9]|[12][0-9]|30)$ ]] || fail E10
[[ "$(fixture_value RELEASE_BACKUP_CLASS)" == immutable && "$(fixture_value RAW_BACKUP_CLASS)" == immutable && "$(fixture_value MAP_BACKUP_CLASS)" == immutable && "$(fixture_value CORRECTION_BACKUP_CLASS)" == deletable ]] || fail E10
[[ "$(fixture_value CREDENTIAL_DELIVERY)" == systemd_loadcredential_root_owned ]] || fail E11
for key in WEB_DB_CREDENTIAL_REF BACKUP_CREDENTIAL_REF OBJECT_CREDENTIAL_REF; do
  [[ "$(fixture_value "$key")" =~ ^/etc/dsa-seats/credentials/[A-Za-z0-9._-]+$ ]] || fail E11
done
for key in BLOCKER_SERVER_ACCESS_DATE BLOCKER_DOMAIN_DNS_DATE BLOCKER_ALERT_DELIVERY_DATE BLOCKER_THREE_HOSTS_DATE BLOCKER_STORAGE_BACKUP_DATE BLOCKER_RPO_RTO_DATE BLOCKER_DELIVERY_CAPACITY_DATE; do
  [[ "$(fixture_value "$key")" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail E10
done

if [[ "$environment" == staging && "$(fixture_value SINGLE_HOST_STAGING)" == true ]]; then
  for suffix in HOST IP FAILURE_DOMAIN; do
    a="$(fixture_value "WEB_OPS_$suffix")"; b="$(fixture_value "POSTGRES_$suffix")"; c="$(fixture_value "MINIO_BACKUP_$suffix")"
    [[ "$a" == "$b" && "$a" == "$c" ]] || fail E12
  done
else
  for suffix in HOST IP FAILURE_DOMAIN; do
    a="$(fixture_value "WEB_OPS_$suffix")"; b="$(fixture_value "POSTGRES_$suffix")"; c="$(fixture_value "MINIO_BACKUP_$suffix")"
    [[ "$a" != "$b" && "$a" != "$c" && "$b" != "$c" ]] || fail E12
  done
fi

principals=(RAW_WRITER_PRINCIPAL RAW_VERIFIER_PRINCIPAL MAP_READER_PRINCIPAL DB_WEB_READER_PRINCIPAL DB_MAP_READER_PRINCIPAL DB_RAW_WRITER_PRINCIPAL DB_RAW_VERIFIER_PRINCIPAL DB_INGEST_PRINCIPAL DB_RELEASE_PREFLIGHT_PRINCIPAL DB_LAUNCH_VERIFIER_PRINCIPAL DB_RELEASE_OPERATOR_PRINCIPAL DB_MIGRATION_OWNER_PRINCIPAL DB_BACKUP_PRINCIPAL DB_MONITORING_PRINCIPAL DB_CORRECTION_INTAKE_PRINCIPAL DB_CORRECTION_REVIEW_PRINCIPAL DB_CORRECTION_REDACTION_PRINCIPAL DB_CORRECTION_MAINTENANCE_PRINCIPAL DB_ADDRESS_LOOKUP_PRINCIPAL DB_ADDRESS_MAINTENANCE_PRINCIPAL)
for ((i = 0; i < ${#principals[@]}; i++)); do
  for ((j = i + 1; j < ${#principals[@]}; j++)); do
    [[ "$(fixture_value "${principals[i]}")" != "$(fixture_value "${principals[j]}")" ]] || fail E12
  done
done
printf '%s\n' 'production environment verification: pass'
