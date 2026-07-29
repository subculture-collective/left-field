#!/usr/bin/env bash
# Shared, non-evaluating parser for identifier-only fixture files.
set -Eeuo pipefail

declare -A FIXTURE_VALUES=()

load_identifier_fixture() {
  local fixture_path="$1" line key value line_number=0
  [[ -f "$fixture_path" && -r "$fixture_path" ]] || return 1
  FIXTURE_VALUES=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    line_number=$((line_number + 1))
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || return 1
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    [[ -z "${FIXTURE_VALUES[$key]+present}" ]] || return 1
    [[ "$value" != *'$('* && "$value" != *'`'* && "$value" != *';'* ]] || return 1
    [[ ! "$value" =~ [[:cntrl:]] ]] || return 1
    FIXTURE_VALUES["$key"]="$value"
  done < "$fixture_path"
}

load_required_schema() {
  local schema_path="$1" line key
  REQUIRED_KEYS=()
  declare -gA REQUIRED_KEY_SET=()
  [[ -f "$schema_path" && -r "$schema_path" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
    key="$line"
    [[ -z "${REQUIRED_KEY_SET[$key]+present}" ]] || return 1
    REQUIRED_KEYS+=("$key")
    REQUIRED_KEY_SET["$key"]=1
  done < "$schema_path"
  ((${#REQUIRED_KEYS[@]} > 0))
}

fixture_value() {
  local key="$1"
  [[ -n "${FIXTURE_VALUES[$key]+present}" ]] || return 1
  printf '%s' "${FIXTURE_VALUES[$key]}"
}
