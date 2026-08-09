#!/bin/sh
set -eu

app_base=${DSA_SEATS_APP_BASE:-/srv/apps/projects/dsa-seats-r1}
case ${APP_IMAGE:-} in
  dsa-seats-r1:[0-9a-f][0-9a-f]*) release_id=${APP_IMAGE#dsa-seats-r1:} ;;
  *) printf '%s\n' "APP_IMAGE must be an exact dsa-seats-r1 release tag" >&2; exit 1 ;;
esac
case $release_id in
  *[!0-9a-f]*|'') printf '%s\n' "APP_IMAGE release tag must be lowercase hexadecimal" >&2; exit 1 ;;
esac
[ ${#release_id} -eq 64 ] || { printf '%s\n' "APP_IMAGE release tag must be 64 characters" >&2; exit 1; }

release_dir=$app_base/releases/$release_id
compose_file=$release_dir/deploy/nuc/factual.compose.yml
env_file=$app_base/runtime/factual.env
[ -f "$compose_file" ] || { printf '%s\n' "exact release compose file is missing" >&2; exit 1; }
[ -f "$env_file" ] || { printf '%s\n' "factual environment file is missing" >&2; exit 1; }

exec /usr/bin/docker compose -p dsa-seats-r1 --env-file "$env_file" -f "$compose_file" run --rm correction-maintenance
