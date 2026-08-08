#!/bin/sh
set -eu

prometheus_config=${PROMETHEUS_CONFIG:-/srv/apps/monitoring/config/prometheus/prometheus.yml}
source_rules=${SOURCE_RULES:-$(dirname "$0")/dsa-seats-alerts.yml}
installed_rules=${INSTALLED_RULES:-/srv/apps/monitoring/config/prometheus/alerts/dsa-seats-alerts.yml}
rule_reference=${PROMETHEUS_RULE_REFERENCE:-/etc/prometheus/alerts/dsa-seats-alerts.yml}
prometheus_container=${PROMETHEUS_CONTAINER:-prometheus}
docker_bin=${DOCKER:-docker}

[ -f "$prometheus_config" ] || { echo "Prometheus config not found" >&2; exit 1; }
[ -f "$source_rules" ] || { echo "DSA Seats rules not found" >&2; exit 1; }

config_dir=$(dirname "$prometheus_config")
rules_dir=$(dirname "$installed_rules")
install -d -m 0755 "$rules_dir"
config_candidate=$(mktemp "$config_dir/.prometheus.yml.dsa-seats.XXXXXX")
config_backup=$(mktemp "$config_dir/.prometheus.yml.dsa-seats-backup.XXXXXX")
rules_backup=$(mktemp "$rules_dir/.dsa-seats-alerts-backup.XXXXXX")
had_rules=0
cleanup() { rm -f "$config_candidate" "$config_backup" "$rules_backup"; }
rollback() {
  install -m 0644 "$config_backup" "$prometheus_config"
  if [ "$had_rules" -eq 1 ]; then install -m 0644 "$rules_backup" "$installed_rules"; else rm -f "$installed_rules"; fi
}
trap cleanup EXIT HUP INT TERM

cp "$prometheus_config" "$config_backup"
if [ -f "$installed_rules" ]; then cp "$installed_rules" "$rules_backup"; had_rules=1; fi

if grep -Fqx "  - $rule_reference" "$prometheus_config"; then
  cp "$prometheus_config" "$config_candidate"
else
  grep -Fqx "rule_files:" "$prometheus_config" || { echo "Prometheus rule_files section not found" >&2; exit 1; }
  grep -Fqx "scrape_configs:" "$prometheus_config" || { echo "Prometheus scrape_configs section not found" >&2; exit 1; }
  awk -v rule="  - $rule_reference" '
    /^scrape_configs:$/ && !inserted { print rule; inserted=1 }
    { print }
    END { if (!inserted) exit 1 }
  ' "$prometheus_config" > "$config_candidate"
fi

install -m 0644 "$source_rules" "$installed_rules"
install -m 0644 "$config_candidate" "$prometheus_config"

if ! "$docker_bin" exec "$prometheus_container" promtool check rules "$rule_reference" >/dev/null \
  || ! "$docker_bin" exec "$prometheus_container" promtool check config /etc/prometheus/prometheus.yml >/dev/null; then
  rollback
  echo "Prometheus rejected the DSA Seats configuration" >&2
  exit 1
fi

echo "DSA Seats Prometheus rules registered; reload or restart Prometheus to activate the atomically replaced config."
