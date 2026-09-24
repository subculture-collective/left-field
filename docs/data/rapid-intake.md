# State and local intake

Status: active procedure, 2026-09-23. Applies to state-legislative, county, municipal, school-board, and judicial primary-result context. These artifacts stay excluded from the released Priority Index.

## What changed

Before this procedure, every state cost a bespoke parser module of roughly 400 to 600 lines with its own copy of the XLSX or CSV reader and hand-typed closure counts, a new chained `local-context-coverage-vN` module, a generator script, an npm script, a hand-edited source-lock entry, and a UI allowlist edit. Validating the newest coverage receipt re-ran all 17 parsers from raw sources (48 seconds in `local-context-coverage-v15.test.ts`).

Now a state is one spec file plus one registry line. The shared code lives in `src/rapid-acquisition/intake/`:

| File | Role |
|---|---|
| `package.ts` | `IntakeSpec` contract, source-lock verification, contest invariants, derived per-cycle and package summaries, hashing, rebuild-and-compare validation |
| `workbook.ts` | XLSX sheet reader with merged-cell expansion |
| `table.ts` | CSV, TSV, and pipe reader with RFC 4180 quoting |
| `source-lock.ts` | Read, verify, upsert, and serialise `data/source-lock.json` in the committed layout |
| `registry.ts` | The list of local-context artifacts: 17 frozen legacy artifacts as data, plus every live spec |
| `coverage.ts` | Registry-driven `rapid-local-context-coverage-v16`, verified from lock-pinned artifact bytes instead of a rebuild chain |
| `specs/` | One file per state; `ohio-state-legislative.ts` is the worked example |

`scripts/rapid/intake.ts` (`npm run rapid:intake`) replaces per-state generator scripts and manual lock edits.

The coverage receipt is regenerated in place. There is no v17; the artifact list is the registry, and the web read model takes its artifact count and child paths from the same registry.

## Adding a state

1. **Write the spec.** Copy `src/rapid-acquisition/intake/specs/ohio-state-legislative.ts`. Declare each source by its future lock id with `cycleYear`, `electionDate`, and a `download` descriptor (`url`, `outputPath` under `data/source/rapid/`). Write `parse` to return normalised contests: office level, office slug, district or null, jurisdiction or null, raw office title, raw party, and candidates with votes. Reconcile against the source's own totals inside `parse` and fail on mismatch.
2. **Register it.** Add the spec to `INTAKE_SPECS` in `src/rapid-acquisition/intake/specs/index.ts`.
3. **Retain sources.** `npm run rapid:intake -- retain <artifact-id>` downloads each declared source over HTTPS, refuses unexpected redirects, and pins bytes and digest in the source lock. The first fetch records the pin; nothing has to be hashed by hand beforehand.
4. **Build.** `npm run rapid:intake -- build <artifact-id>` writes `data/metadata/<artifact-id>.json`, pins it in the lock with its sources as parents, and regenerates the coverage receipt and its lock entry. The command prints the summary and per-cycle counts.
5. **Pin closure.** Copy the printed counts into the spec's `expect` blocks so a silent source change fails the next build. Add a short receipt under `docs/reviews/` with the printed digests.
6. **Verify.** `npm run rapid:intake -- check` rebuilds every registered intake artifact from retained bytes and compares. `npm run data:verify` remains the repository gate.

A spec cannot mark winners, resolve holder identity, or set formula eligibility; those fields are fixed by the builder and the coverage build rejects any artifact whose summary reports formula-eligible rows.

## Trust model

Per-artifact truth still comes from a rebuild: each artifact's test and `rapid:intake check` re-parse the retained source bytes. The coverage receipt trusts the source lock for artifact bytes, which is the same trust the web read model already applied. What is no longer done is re-running every parser whenever any one artifact is added.

The 17 legacy artifacts are frozen. Their modules, tests, and v1 through v15 receipts remain in place and unchanged; the registry lists them as data so the coverage build does not import them. Do not port them: their artifact digests are pinned in the lock and in review receipts, and a port would churn every hash for no new evidence.

## Verification of this change

Run on 2026-09-23 in this worktree:

- `npx vitest run src/rapid-acquisition/intake src/ui/rapid-local-context-coverage.test.ts`: 6 files, 21 tests, 1.9 seconds.
- The Ohio spec reproduces the frozen v1 closure (221 contests, 282 candidate rows, 1,632,849 votes) through the shared builder.
- The v16 receipt's artifact list equals the v15 receipt's artifact list.
- `npm run typecheck`, `npm run lint` (zero warnings after removing 154 unused imports and one dead FEC coordinator function), and `npm run data:verify` (1,144 entries) pass.
- Vitest now uses a 60-second per-test timeout in `vitest.config.mts`; rebuild-and-compare tests routinely exceed the 5-second default under parallel load.
- The AIPAC numeric-evidence v4 tests skip, rather than fail, when the non-retained FEC PAS2 archives are absent; set `DSA_SEATS_AIPAC_PAS2_DIR` to run them.
