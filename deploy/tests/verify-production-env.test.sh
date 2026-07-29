#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
VERIFY="$ROOT/deploy/scripts/verify-production-env.sh"
VALID="$ROOT/deploy/tests/fixtures/valid-production.env"
SCHEMA="$ROOT/deploy/env/production.env.schema"
TMPDIR="$(mktemp -d)"
trap 'rm -rf -- "$TMPDIR"' EXIT

expect_pass() { bash "$VERIFY" --fixture "$1" >/dev/null; }
expect_fail() { if bash "$VERIFY" --fixture "$1" >/dev/null 2>&1; then return 1; fi; }
omit_key() {
  local key="$1" output="$2" line
  : > "$output"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == "$key="* ]] || printf '%s\n' "$line" >> "$output"
  done < "$VALID"
}
replace_key() {
  local key="$1" value="$2" output="$3" line
  : > "$output"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$key="* ]]; then printf '%s=%s\n' "$key" "$value" >> "$output"; else printf '%s\n' "$line" >> "$output"; fi
  done < "$VALID"
}
replace_in_file() {
  local input="$1" key="$2" value="$3" output="$4" line
  : > "$output"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$key="* ]]; then printf '%s=%s\n' "$key" "$value" >> "$output"; else printf '%s\n' "$line" >> "$output"; fi
  done < "$input"
}
read_schema_keys() {
  local line key
  SCHEMA_KEYS=()
  declare -A seen=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
    key="$line"
    [[ -z "${seen[$key]+present}" ]] || return 1
    seen["$key"]=1
    SCHEMA_KEYS+=("$key")
  done < "$SCHEMA"
}
read_fixture_keys() {
  local line key
  FIXTURE_KEYS=()
  declare -A seen=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)= ]] || return 1
    key="${BASH_REMATCH[1]}"
    [[ -z "${seen[$key]+present}" ]] || return 1
    seen["$key"]=1
    FIXTURE_KEYS+=("$key")
  done < "$VALID"
}

expect_pass "$VALID"
read_schema_keys
read_fixture_keys
[[ "${SCHEMA_KEYS[*]}" == "${FIXTURE_KEYS[*]}" ]]
for key in "${SCHEMA_KEYS[@]}"; do omit_key "$key" "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"; done
for key in WEB_DB_CREDENTIAL_REF BACKUP_CREDENTIAL_REF OBJECT_CREDENTIAL_REF; do replace_key "$key" '' "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"; done
for pair in 'POSTGRES_HOST:web-ops-synthetic' 'POSTGRES_IP:198.51.100.11' 'POSTGRES_FAILURE_DOMAIN:fd-web-synthetic'; do replace_key "${pair%%:*}" "${pair#*:}" "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"; done
for pair in 'APP_IMAGE_DIGEST:registry/synthetic:latest' 'BACKUP_ENGINE:unset' 'RPO_MINUTES:0' 'RTO_MINUTES:0' 'RTO_MINUTES:one' 'RELEASE_BACKUP_CLASS:deletable' 'WEB_DB_CREDENTIAL_REF:plain-secret' 'REGISTRY_NAMESPACE:example' 'OFFSITE_TARGET_ID:https://user:password@host' 'BLOCKER_RPO_RTO_APPROVAL:TBD' 'BLOCKER_RPO_RTO_DATE:July-22' 'SINGLE_HOST_STAGING:true'; do replace_key "${pair%%:*}" "${pair#*:}" "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"; done
for retention in 1 30; do replace_key CORRECTION_BACKUP_RETENTION_DAYS "$retention" "$TMPDIR/case.env"; expect_pass "$TMPDIR/case.env"; done
for retention in 0 31; do replace_key CORRECTION_BACKUP_RETENTION_DAYS "$retention" "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"; done
for payload in '$(touch /tmp/fixture-evaluated)' '`touch /tmp/fixture-evaluated`' 'safe;touch /tmp/fixture-evaluated'; do replace_key REGISTRY_NAMESPACE "$payload" "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"; done
control_payload=$'safe\001payload'
replace_key REGISTRY_NAMESPACE "$control_payload" "$TMPDIR/case.env"; expect_fail "$TMPDIR/case.env"
[[ ! -e /tmp/fixture-evaluated ]]
printf '%s\n' 'not-an-assignment' > "$TMPDIR/malformed.env"; expect_fail "$TMPDIR/malformed.env"
printf '%s\n' 'lower_key=value' > "$TMPDIR/malformed-key.env"; expect_fail "$TMPDIR/malformed-key.env"
replace_key REGISTRY_NAMESPACE valid "$TMPDIR/one.env"
printf '%s\n' 'REGISTRY_NAMESPACE=duplicate' >> "$TMPDIR/one.env"; expect_fail "$TMPDIR/one.env"
printf '%s\n' 'UNDECLARED_SECRET=not-allowed' > "$TMPDIR/secret.env"
while IFS= read -r line || [[ -n "$line" ]]; do printf '%s\n' "$line" >> "$TMPDIR/secret.env"; done < "$VALID"
expect_fail "$TMPDIR/secret.env"
replace_key ENVIRONMENT staging "$TMPDIR/staging.env"
expect_pass "$TMPDIR/staging.env"
replace_in_file "$TMPDIR/staging.env" SINGLE_HOST_STAGING true "$TMPDIR/staging2.env"
for suffix in HOST IP FAILURE_DOMAIN; do
  case "$suffix" in HOST) value=web-ops-synthetic ;; IP) value=198.51.100.11 ;; FAILURE_DOMAIN) value=fd-web-synthetic ;; esac
  replace_in_file "$TMPDIR/staging2.env" "POSTGRES_$suffix" "$value" "$TMPDIR/staging3.env"
  replace_in_file "$TMPDIR/staging3.env" "MINIO_BACKUP_$suffix" "$value" "$TMPDIR/staging2.env"
done
expect_pass "$TMPDIR/staging2.env"
for suffix in HOST IP FAILURE_DOMAIN; do
  replace_in_file "$TMPDIR/staging2.env" "POSTGRES_$suffix" mismatch-synthetic "$TMPDIR/staging3.env"; expect_fail "$TMPDIR/staging3.env"
  replace_in_file "$TMPDIR/staging.env" "POSTGRES_$suffix" web-ops-synthetic "$TMPDIR/staging3.env"; expect_fail "$TMPDIR/staging3.env"
done
verifier_text="$(<"$VERIFY")"
[[ ! "$verifier_text" =~ (curl|wget|ssh|nc[[:space:]]|ping|ansible|docker) ]]
[[ "$verifier_text" == *'load_required_schema "$SCHEMA_PATH"'* ]]
printf '%s\n' 'verify-production-env tests: pass'
