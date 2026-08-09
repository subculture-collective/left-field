#!/bin/sh
set -eu

encode_password() {
  secret_path=$1
  secret_value=$(tr -d '\r\n' < "$secret_path")
  [ -n "$secret_value" ] || { printf '%s\n' "empty secret: $secret_path" >&2; exit 1; }
  SECRET_VALUE="$secret_value" node -e 'process.stdout.write(encodeURIComponent(process.env.SECRET_VALUE))'
}

database_host=${DATABASE_HOST:-postgres}
database_name=${DATABASE_NAME:-dsa_seats_r1}

if [ -r /run/secrets/db_admin_password ]; then
  admin_password=$(encode_password /run/secrets/db_admin_password)
  export DATABASE_URL="postgresql://dsa_seats_admin:${admin_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_web_password ]; then
  web_password=$(encode_password /run/secrets/db_web_password)
  export WEB_DATABASE_URL="postgresql://dsa_seats_web_login:${web_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_ingest_password ]; then
  ingest_password=$(encode_password /run/secrets/db_ingest_password)
  export INGEST_DATABASE_URL="postgresql://dsa_seats_ingest_login:${ingest_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_preflight_password ]; then
  preflight_password=$(encode_password /run/secrets/db_preflight_password)
  export RELEASE_PREFLIGHT_DATABASE_URL="postgresql://dsa_seats_preflight_login:${preflight_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_operator_password ]; then
  operator_password=$(encode_password /run/secrets/db_operator_password)
  export RELEASE_OPERATOR_DATABASE_URL="postgresql://dsa_seats_operator_login:${operator_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_launch_verifier_password ]; then
  launch_verifier_password=$(encode_password /run/secrets/db_launch_verifier_password)
  export LAUNCH_VERIFIER_DATABASE_URL="postgresql://dsa_seats_launch_verifier_login:${launch_verifier_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_nationwide_finalizer_password ]; then
  nationwide_finalizer_password=$(encode_password /run/secrets/db_nationwide_finalizer_password)
  export NATIONWIDE_FINALIZER_DATABASE_URL="postgresql://dsa_seats_nationwide_finalizer_login:${nationwide_finalizer_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_fec_v2_acquisition_password ]; then
  fec_v2_acquisition_password=$(encode_password /run/secrets/db_fec_v2_acquisition_password)
  export FEC_V2_ACQUISITION_DATABASE_URL="postgresql://dsa_seats_fec_v2_acquisition_login:${fec_v2_acquisition_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_fec_v2_replay_verifier_password ]; then
  fec_v2_replay_verifier_password=$(encode_password /run/secrets/db_fec_v2_replay_verifier_password)
  export FEC_V2_REPLAY_VERIFIER_DATABASE_URL="postgresql://dsa_seats_fec_v2_replay_verifier_login:${fec_v2_replay_verifier_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/db_correction_reviewer_password ]; then
  correction_reviewer_password=$(encode_password /run/secrets/db_correction_reviewer_password)
  export CORRECTION_REVIEWER_DATABASE_URL="postgresql://dsa_seats_correction_reviewer_login:${correction_reviewer_password}@${database_host}:5432/${database_name}"
fi
if [ -r /run/secrets/fec_api_credential ]; then
  FEC_API_CREDENTIAL=$(tr -d '\r\n' < /run/secrets/fec_api_credential)
  [ -n "$FEC_API_CREDENTIAL" ] || { printf '%s\n' "empty secret: /run/secrets/fec_api_credential" >&2; exit 1; }
  export FEC_API_CREDENTIAL
fi
if [ -r /run/secrets/fec_store_access_key ] && [ -r /run/secrets/fec_store_secret_key ]; then
  FEC_V2_S3_ACCESS_KEY_ID=$(tr -d '\r\n' < /run/secrets/fec_store_access_key)
  FEC_V2_S3_SECRET_ACCESS_KEY=$(tr -d '\r\n' < /run/secrets/fec_store_secret_key)
  [ -n "$FEC_V2_S3_ACCESS_KEY_ID" ] && [ -n "$FEC_V2_S3_SECRET_ACCESS_KEY" ] \
    || { printf '%s\n' "empty FEC v2 object-store secret" >&2; exit 1; }
  export FEC_V2_S3_ACCESS_KEY_ID FEC_V2_S3_SECRET_ACCESS_KEY
fi
if [ -r /run/secrets/raw_access_key ] && [ -r /run/secrets/raw_secret_key ]; then
  export AWS_ACCESS_KEY_ID
  export AWS_SECRET_ACCESS_KEY
  AWS_ACCESS_KEY_ID=$(tr -d '\r\n' < /run/secrets/raw_access_key)
  AWS_SECRET_ACCESS_KEY=$(tr -d '\r\n' < /run/secrets/raw_secret_key)
fi

exec "$@"
