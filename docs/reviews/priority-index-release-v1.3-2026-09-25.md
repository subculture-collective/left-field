# Priority Index v1.3: governors on the two-route model — 2026-09-25

## Outcome

V1.3 adds the fifty sitting governors to the ranked list as a third chamber. `governor-score-v01-projection-v1` reads the Open States executive rosters (201 YAML files across the fifty states and DC, CC0, retained 2026-09-25 with their raw GitHub URLs), selects the governor role current at the snapshot date, and scores each state with the chamber-agnostic two-route model. The House (v0.11) and Senate (v0.1) layers are unchanged.

| Measure | Value |
|---|---:|
| Governors | 50 (24 Democratic caucus incl. DFL, 26 Republican) |
| Up in 2026 | 36 |
| State contestation values | 5 Republican-held states |
| Highest Democratic-route score | 81.0 (MD-Gov) |
| Highest Republican-route score | 78.0 (NH-Gov, VT-Gov) |

## What is and is not measured

No governor campaign-finance, alignment, or primary evidence is retained, so those weights are omitted and the rest renormalized. The Democratic route reduces to the blue baseline (65% of the weight available, coverage multiplier 0.86) and the Republican route to competitiveness plus state contestation where it exists. Every brief says this. Term limits and announced retirements are not observed; the next election year is derived from the roster's term end date (the year before a January end, otherwise the end year).

## Data path

- `refresh-inputs.json` now names the executive roster files; `rapid:refresh` lists each state's `data/<st>/executive` directory through the GitHub contents API and retains every YAML with its raw URL.
- The executive reader parses the small YAML subset these files use (scalar keys, `party` and `roles` lists) and skips offices, links, ids, and sources; anything else fails the build.
- The release descriptor gains a `governor` chamber entry; `rapid:publish` writes it.

## Reproduction

```sh
npm run rapid:intake -- derive governor-score-v01-projection-v1
npm run rapid:publish -- --version v1.3 --date 2026-09-25
npx vitest run src/rapid-acquisition/governor-score-v01.test.ts src/lib src/ui src/app
npm run typecheck
npm run lint
npm run data:verify
```
