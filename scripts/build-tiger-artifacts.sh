#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
geometry="$root/data/geometry"
source="$root/data/source/tiger2025"
tmp="$(mktemp -d "$geometry/.tiger-build.XXXXXX")"
backup=""
names=(tiger2025-ak-cd119-selected.geojson tiger2025-al-cd119-selected.geojson tiger2025-az-cd119-selected.geojson tiger2025-fl-cd119-selected.geojson tiger2025-selected-states.geojson)
cleanup() {
  local status="$?"
  if [[ -n "$backup" && -d "$backup" ]]; then
    for name in "${names[@]}"; do rm -f "$geometry/$name"; [[ -e "$backup/$name" ]] && mv "$backup/$name" "$geometry/$name"; done
    rmdir "$backup"
  fi
  rm -rf "$tmp"
  return "$status"
}
trap cleanup EXIT

build() {
  local zip="$1" out="$2" filter="$3"
  "$root/node_modules/.bin/mapshaper" "$source/$zip" -proj wgs84 -filter "$filter" -o format=geojson precision=0.0000001 "$tmp/$out"
}
build tl_2025_02_cd119.zip tiger2025-ak-cd119-selected.geojson 'STATEFP == "02" && CD119FP == "00"'
build tl_2025_01_cd119.zip tiger2025-al-cd119-selected.geojson 'STATEFP == "01" && (CD119FP == "02" || CD119FP == "05" || CD119FP == "07")'
build tl_2025_04_cd119.zip tiger2025-az-cd119-selected.geojson 'STATEFP == "04" && (CD119FP == "01" || CD119FP == "06" || CD119FP == "07")'
build tl_2025_12_cd119.zip tiger2025-fl-cd119-selected.geojson 'STATEFP == "12" && (CD119FP == "06" || CD119FP == "12" || CD119FP == "26")'
build tl_2025_us_state.zip tiger2025-selected-states.geojson 'STATEFP == "02" || STATEFP == "01" || STATEFP == "04" || STATEFP == "12"'
node "$root/scripts/normalize-tiger-artifacts.mjs" "$tmp" "$tmp/normalized"
backup="$(mktemp -d "$geometry/.tiger-backup.XXXXXX")"
for name in "${names[@]}"; do mv "$geometry/$name" "$backup/$name"; done
for name in "${names[@]}"; do mv "$tmp/normalized/$name" "$geometry/$name"; done
rm -rf "$backup"
backup=""
