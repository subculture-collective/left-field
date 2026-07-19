#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$root/data/source/tiger2025"; output_dir="$root/data/geometry"; source_lock=""; mapshaper="$root/node_modules/.bin/mapshaper"; tsx="$root/node_modules/.bin/tsx"
while (($#)); do case "$1" in --source-dir) source_dir="$2";shift 2;; --output-dir) output_dir="$2";shift 2;; --source-lock) source_lock="$2";shift 2;; --mapshaper) mapshaper="$2";shift 2;; --tsx) tsx="$2";shift 2;; *) exit 64;; esac; done
[[ -n "$source_lock" && -x "$mapshaper" && -x "$tsx" && -d "$source_dir" && -d "$output_dir" ]] || { printf 'national TIGER: source lock, local tools, source, and output are required\n' >&2; exit 64; }
lock="$output_dir/.national-tiger.lock"; mkdir "$lock" 2>/dev/null || { printf 'national TIGER: another builder holds the lock\n' >&2; exit 75; }; stage=""; tmp_pointer=""; cleanup() { local status=$?; [[ -z "$tmp_pointer" ]] || rm -f "$tmp_pointer" || :; [[ -z "$stage" ]] || rm -rf "$stage" || :; rmdir "$lock" 2>/dev/null || :; trap - EXIT; exit "$status"; }; trap cleanup EXIT; stage="$(mktemp -d "$output_dir/.national-tiger-stage.XXXXXX")"
fips=(01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56 60 66 69 72 78); cd_inputs=(); for f in "${fips[@]}"; do cd_inputs+=("$source_dir/tl_2025_${f}_cd119.zip"); done
"$mapshaper" -i "${cd_inputs[@]}" combine-files -merge-layers force -proj wgs84 -filter 'CDSESSN == "119" && CD119FP != "ZZ"' -o format=geojson precision=0.0000001 "$stage/raw-cd119.geojson"
"$mapshaper" "$source_dir/tl_2025_us_state.zip" -proj wgs84 -o format=geojson precision=0.0000001 "$stage/raw-states.geojson"
[[ -s "$stage/raw-cd119.geojson" && -s "$stage/raw-states.geojson" ]] || { printf 'national TIGER: mapshaper did not produce both raw FeatureCollections\n' >&2; exit 1; }
mkdir -p "$output_dir/versions"; bundle="$("$tsx" "$root/scripts/compile-national-tiger-artifacts.ts" --source-lock "$source_lock" --source-dir "$source_dir" --raw-cd119 "$stage/raw-cd119.geojson" --raw-states "$stage/raw-states.geojson" --bundle-root "$output_dir/versions")"
tmp_pointer="$output_dir/.current-${bundle}.tmp"; ln -s "versions/$bundle" "$tmp_pointer"; mv -Tf "$tmp_pointer" "$output_dir/current"
