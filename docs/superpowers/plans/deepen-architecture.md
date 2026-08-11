# Architecture Deepening Plan

Generated 2026-08-10 from `improve-codebase-architecture` review.

## Glossary

These terms from the improvement skill's LANGUAGE.md apply throughout:

- **Module** — anything with an interface and an implementation.
- **Interface** — everything a caller must know: types, invariants, error modes, ordering, config.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface. Deep = much behaviour behind a small interface.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place.
- **Adapter** — concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get: change, bugs, knowledge concentrated in one place.
- **Deletion test** — imagine deleting the module. If complexity vanishes, pass-through. If it reappears across N callers, it earned its keep.
- **One adapter = hypothetical seam. Two adapters = real seam.**

## Findings Summary

| # | Finding | Files affected | Severity |
|---|---------|---------------|----------|
| 1 | Priority Index is filesystem-coupled static data blob, bypasses repository seam | `lib/house-priority-index.ts`, `lib/priority-briefs.ts`, `app/priorities/` | High |
| 2 | Rapid-acquisition versioned pipeline proliferation (200+ files of copy-paste) | `rapid-acquisition/`, `scripts/rapid/` | High |
| 3 | View-models are shallow pass-through | `ui/view-models.ts`, all pages | Low |
| 4 | Domain contracts monolith (529-line single file) | `domain/contracts.ts` | Medium |
| 5 | Ingestion module has no seam toward the main system | `ingestion/` (8 subdirs), `scripts/` (300+ scripts) | Medium |
| 6 | Server-data growing toward god module | `ui/server-data.ts` | Low |
| 7 | Priority briefs have no repository seam | `lib/house-priority-index.ts`, `lib/priority-briefs.ts` | Medium |
| 8 | No seam for map artifact serving | `maps/`, `app/maps/`, `components/seat-map.tsx` | Medium |

## Plan

### Phase 1 — Foundation (low-risk, enabling)

#### 1. Split Domain Contracts (#4)

Split `src/domain/contracts.ts` into domain-concept files:

- `src/domain/contracts/primitives.ts` — branded IDs, `isoDateSchema`, `sha256Schema`, `usStateCodeSchema`
- `src/domain/contracts/identity.ts` — `chamberSchema`, `officeKindSchema`, `partySchema`, `seatCycleIdSchema`, `officeSchema`, etc.
- `src/domain/contracts/elections.ts` — `contestSchema`, `electionResultSchema`, `electionDecisionSchema`, etc.
- `src/domain/contracts/finance.ts` — `fecFilingSummarySchema`, `financeAggregateSchema`, `committeeSchema`, `fundingCategoryAggregateSchema`, etc.
- `src/domain/contracts/geography.ts` — `geographyVersionSchema`, `geometryArtifactSchema`, `districtPlanSchema`, etc.
- `src/domain/contracts/sources.ts` — `sourceSchema`, `sourceSnapshotSchema`, `provenanceRoleSchema`, etc.
- `src/domain/contracts/index.ts` — barrel re-export, preserving backward compatibility

**Risk:** Low. Pure file reorganization, no behavior change. All existing imports continue working via barrel.

#### 2. Eliminate View-Models (#3)

- Move compile functions (`compileBrowsePage`, `compileProfilePage`, etc.) into `src/ui/server-data.ts` (already the sole caller)
- Drop `Immutable<T>` wrappers; use `Readonly<>` at domain type level where needed
- Have page components import domain types directly
- Remove `src/ui/view-models.ts`

**Risk:** Low. Mechanical refactor. Pages already receive the same shapes.

#### 3. Decouple Server-Data (#6)

- Extract `parseBrowseQuery`, `classifyProfileRequest`, `classifyProfileLookup` into `src/ui/query-parsing.ts`
- Extract `repository()` factory into `src/ui/repository-factory.ts`
- Each page imports only its specific loader function

**Risk:** Low. Internal refactor within `src/ui/`.

### Phase 2 — Seams (new interfaces, structural)

#### 4. Map Store Interface (#8)

Define `MapStore` interface in `src/maps/contracts.ts`:

```typescript
type MapArtifact = { data: Buffer; checksumSha256: string; contentType: string };
interface MapStore {
  getArtifact(releaseId: ReleaseId, geographyId: string): Promise<MapArtifact | null>;
}
```

Adapters:
- `src/maps/s3-map-store.ts` — current S3 logic, extracted
- `src/maps/in-memory-map-store.ts` — for tests

Update `app/maps/[releaseId]/[geographyId]/route.ts` to use `MapStore`.
Update `SeatMap` component to accept a pre-loaded descriptor object instead of raw fetch.

**Risk:** Medium. Changes map route handler. Must preserve S3 auth semantics.

#### 5. Ingestion Pipeline Seams (#5)

Define `IngestionPipeline` interface in `src/ingestion/core/contracts.ts`:

```typescript
type IngestionInput = { releaseId: ReleaseId; sourceSnapshot: SourceSnapshot; planConfig: unknown };
type IngestionOutput = { candidateRecords: unknown[]; digest: string; failures: IngestionFailure[] };
interface IngestionPipeline {
  readonly domain: string;
  ingest(input: IngestionInput): Promise<IngestionOutput>;
}
```

Each pipeline subdirectory (acs, elections, fec, identity, tiger, scoring) implements the interface.
Add in-memory source adapter for testing.
Refactor `scripts/ingest.ts` to load and run pipelines by domain name.

**Risk:** Medium. Touches ingestion hot path. Must preserve exact database output. Each pipeline converted incrementally.

#### 6. Priority Index Repository Seam (#1)

Define `PriorityIndexRepository` in `src/domain/repository.ts`:

```typescript
type ModelRelease = { version: string; publishedAt: string; cutoffDate: string };
type ScoredBrief = { rank: number; seatCycleId: string; ... };
interface PriorityIndexRepository {
  getModelRelease(): ModelRelease;
  getBriefs(): readonly ScoredBrief[];
  getBrief(seatCycleId: string): ScoredBrief | null;
}
```

Adapters:
- `ActiveHousePriorityRepository` — current `house-priority-index.ts` logic, with DI for file reading
- `InMemoryPriorityRepository` — for tests

Extract pure scoring logic into `src/domain/scoring/house-priority-scorer.ts` — takes structured input, returns scored briefs (zero filesystem access).

Update priorities pages to use repository. Version string moves from JSX literal to data field.

**Risk:** Medium-High. Most visible user-facing page. Byte-for-byte output comparison required for scoring logic.

#### 7. Priority Briefs as Modeled Domain (#7)

- Extend `PriorityIndexRepository.getModelRelease()` per #6
- Move `priority-briefs.ts` data into repository adapter
- All model metadata becomes data, not hardcoded strings

**Risk:** Low. Additive to #6. Can be done together.

### Phase 3 — Consolidation (highest effort)

#### 8. Rapid-Acquisition Pipeline Consolidation (#2)

Define `RapidAcquisitionPipeline` interface:

```typescript
type StateConfig = { stateCode: string; electionYear: number; sourceUrls: Record<string, string> };
interface RapidAcquisitionPipeline {
  acquire(config: StateConfig): Promise<AcquisitionReceipt>;
  generate(receipt: AcquisitionReceipt): Promise<StructuredResults>;
  project(results: StructuredResults[]): Promise<ProjectionOutput>;
}
```

- Implement pipeline once for each operation type (acquire, generate, project)
- Convert per-state scripts into config tables (state → source URLs + params)
- Per-state files become thin adapters: `pipeline.acquire(CONFIGS.alabama_2026)`
- Proof-of-concept with one state first; verify byte-identical output, then convert remainder

**Risk:** Highest. Touches 200+ files. Must produce identical outputs. Start with single-state POC.

## Execution Order

```
Phase 1:
  #4 (contracts split) ──┐
                         ├──→ #3 (view-models) ──→ #6 (server-data)
  (no dependencies)      │

Phase 2 (after Phase 1):
  #8 (map store)  ← independent of everything else
  #5 (ingestion)  ← independent of everything else
  Phase 1 + #6 done ──→ #1 (priority scoring seam) ──→ #7 (scoring model domain)

Phase 3 (after #2 and #5):
  #5 (ingestion seam) ──→ #8 (rapid-acquisition consolidation)
```

Steps #4, #5, #8 all have no upstream dependencies and can start in parallel where resources permit.

## Acceptance Criteria

For each step, acceptance means:
1. All existing tests pass without modification (except import path updates)
2. New tests cover the new seam (in-memory adapter round-trips)
3. No behavioral change in any page, route handler, or script output
4. TypeScript compilation succeeds with `tsc --noEmit`
5. `make check` passes