import { readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { byteCompare, exact, hash } from "./shared";

/**
 * State-level Democratic primary contestation from the retained local-context catalogs.
 *
 * This is the first formula use of the state and local intake. For every retained
 * state-legislative, county-office, or local-office catalog it counts, per state and
 * cycle, the Democratic contests, how many drew more than one candidate, and the
 * Democratic votes cast. Where a catalog records uncontested primaries as well as
 * contested ones, the contested share becomes a bounded 0..100 contestation score
 * (100 at a 40% contested share). Catalogs that retain only candidate-bearing or
 * contested primaries cannot yield a comparable share and stay formula-ineligible.
 *
 * Only state-legislative rows feed the House score. County and local rows are
 * retained for context; comparing sheriff primaries with legislative primaries
 * would not be a like-for-like measure.
 */
export type OfficeScope = "state_legislative" | "county_office" | "local_office";

export interface StateLegislativePrimaryContextRow {
  readonly state: string;
  readonly cycleYear: number;
  readonly officeScope: OfficeScope;
  readonly sourceArtifactId: string;
  readonly democraticContests: number;
  readonly contestedDemocraticContests: number;
  readonly democraticVotes: number;
  readonly uncontestedContestsRecorded: boolean;
  readonly contestedShare: number | null;
  readonly contestationScore: number | null;
  readonly formulaEligible: boolean;
  readonly ineligibleReason: "source_retains_contested_primaries_only" | "office_scope_not_state_legislative" | null;
  readonly rowSha256: string;
}

export interface StateContestationContext {
  readonly state: string;
  readonly cycleYear: number;
  readonly sourceArtifactId: string;
  readonly democraticContests: number;
  readonly contestedDemocraticContests: number;
  readonly contestedShare: number;
  readonly contestationScore: number;
}

export interface StateLegislativePrimaryContext {
  readonly schema: "rapid-state-legislative-primary-context-v1";
  readonly version: 1;
  readonly methodology: Readonly<{
    contestedDefinition: "more_than_one_named_candidate_in_a_democratic_contest";
    contestationScale: "clamp(contested_share_percent / 40 * 100, 0, 100)";
    stateSelection: "latest_cycle_with_uncontested_contests_recorded_per_state_legislative_catalog";
    winnerInference: false;
    holderIdentity: "not_collected";
  }>;
  readonly sourceIds: readonly string[];
  readonly rows: readonly StateLegislativePrimaryContextRow[];
  readonly stateContext: readonly StateContestationContext[];
  readonly summary: Readonly<{ catalogs: number; rows: number; formulaEligibleRows: number; statesWithContext: number; democraticContests: number; contestedDemocraticContests: number; democraticVotes: number }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const STATE_LEGISLATIVE_PRIMARY_CONTEXT = {
  id: "rapid-state-legislative-primary-context-v1",
  path: "data/metadata/rapid-state-legislative-primary-context-v1.json",
  url: "urn:dsa-seats:rapid-state-legislative-primary-context:v1",
} as const;

type Adapter = Readonly<{
  id: string;
  state: string;
  officeScope: OfficeScope;
  democraticLabels: readonly string[];
  uncontestedContestsRecorded: boolean;
  /** Vote count per named candidate, in source order. */
  candidateVotes: (contest: Record<string, unknown>) => number[];
}>;

const votesOf = (candidate: Record<string, unknown>): number => {
  const value = candidate.votes ?? candidate.totalVotes;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("STATE_LEG_CONTEXT_CANDIDATE_VOTES_INVALID");
  return value as number;
};
const listVotes = (contest: Record<string, unknown>): number[] => (contest.candidates as Record<string, unknown>[]).map(votesOf);

const ADAPTERS: readonly Adapter[] = [
  { id: "rapid-indiana-state-legislative-primary-results-v1", state: "IN", officeScope: "state_legislative", democraticLabels: ["D"], uncontestedContestsRecorded: true, candidateVotes: listVotes },
  { id: "rapid-tennessee-state-legislative-primary-results-v1", state: "TN", officeScope: "state_legislative", democraticLabels: ["D"], uncontestedContestsRecorded: true, candidateVotes: (contest) => (contest.sourceObservations as Record<string, unknown>[]).filter((row) => row.entryKind === "source_named_candidate").map(votesOf) },
  { id: "rapid-georgia-state-legislative-primary-results-v1", state: "GA", officeScope: "state_legislative", democraticLabels: ["D"], uncontestedContestsRecorded: true, candidateVotes: listVotes },
  { id: "rapid-north-carolina-state-legislative-primary-results-v1", state: "NC", officeScope: "state_legislative", democraticLabels: ["D"], uncontestedContestsRecorded: false, candidateVotes: listVotes },
  { id: "rapid-alabama-state-legislative-primary-results-v1", state: "AL", officeScope: "state_legislative", democraticLabels: ["DEM"], uncontestedContestsRecorded: false, candidateVotes: listVotes },
  { id: "rapid-delaware-state-legislative-primary-results-v1", state: "DE", officeScope: "state_legislative", democraticLabels: ["Democratic Party"], uncontestedContestsRecorded: false, candidateVotes: listVotes },
  { id: "rapid-hawaii-state-legislative-primary-results-v1", state: "HI", officeScope: "state_legislative", democraticLabels: ["D"], uncontestedContestsRecorded: true, candidateVotes: listVotes },
  { id: "rapid-missouri-state-legislative-primary-results-v1", state: "MO", officeScope: "state_legislative", democraticLabels: ["Democratic"], uncontestedContestsRecorded: true, candidateVotes: listVotes },
  { id: "rapid-kentucky-state-legislative-primary-results-v1", state: "KY", officeScope: "state_legislative", democraticLabels: ["Democratic"], uncontestedContestsRecorded: false, candidateVotes: listVotes },
  { id: "rapid-ohio-state-legislative-democratic-primary-results-v1", state: "OH", officeScope: "state_legislative", democraticLabels: ["DEM"], uncontestedContestsRecorded: true, candidateVotes: listVotes },
  { id: "rapid-north-carolina-local-office-primary-results-v1", state: "NC", officeScope: "local_office", democraticLabels: ["D"], uncontestedContestsRecorded: false, candidateVotes: listVotes },
  { id: "rapid-new-mexico-county-office-primary-results-v1", state: "NM", officeScope: "county_office", democraticLabels: ["DEM"], uncontestedContestsRecorded: true, candidateVotes: listVotes },
];

const one = (value: number): number => Math.round(value * 10) / 10;
export const contestationScore = (contestedSharePercent: number): number => one(Math.max(0, Math.min(100, (contestedSharePercent / 40) * 100)));

export function buildStateLegislativePrimaryContext(root = process.cwd(), lock: SourceLock = readSourceLock(root)): StateLegislativePrimaryContext {
  const rows: StateLegislativePrimaryContextRow[] = [];
  for (const adapter of ADAPTERS) {
    const { bytes } = readRetainedSource(lock, adapter.id, root);
    const artifact = JSON.parse(bytes.toString("utf8")) as { contests?: Record<string, unknown>[] };
    if (!Array.isArray(artifact.contests) || !artifact.contests.length) throw new Error(`STATE_LEG_CONTEXT_CONTESTS_MISSING:${adapter.id}`);
    const byCycle = new Map<number, { contests: number; contested: number; votes: number }>();
    for (const contest of artifact.contests) {
      if (!adapter.democraticLabels.includes(String(contest.rawParty))) continue;
      if (contest.formulaEligible !== false) throw new Error(`STATE_LEG_CONTEXT_SOURCE_FORMULA_STATE_INVALID:${adapter.id}`);
      const cycleYear = contest.cycleYear;
      if (!Number.isSafeInteger(cycleYear)) throw new Error(`STATE_LEG_CONTEXT_CYCLE_INVALID:${adapter.id}`);
      const votes = adapter.candidateVotes(contest);
      if (!votes.length) continue;
      const cycle = byCycle.get(cycleYear as number) ?? { contests: 0, contested: 0, votes: 0 };
      cycle.contests += 1;
      if (votes.length > 1) cycle.contested += 1;
      cycle.votes += votes.reduce((sum, value) => sum + value, 0);
      byCycle.set(cycleYear as number, cycle);
    }
    for (const [cycleYear, cycle] of byCycle) {
      const comparable = adapter.uncontestedContestsRecorded;
      const contestedShare = comparable ? one((100 * cycle.contested) / cycle.contests) : null;
      const eligible = comparable && adapter.officeScope === "state_legislative";
      const unsigned = {
        state: adapter.state, cycleYear, officeScope: adapter.officeScope, sourceArtifactId: adapter.id,
        democraticContests: cycle.contests, contestedDemocraticContests: cycle.contested, democraticVotes: cycle.votes,
        uncontestedContestsRecorded: comparable, contestedShare,
        contestationScore: contestedShare === null ? null : contestationScore(contestedShare),
        formulaEligible: eligible,
        ineligibleReason: eligible ? null : !comparable ? ("source_retains_contested_primaries_only" as const) : ("office_scope_not_state_legislative" as const),
      };
      rows.push({ ...unsigned, rowSha256: hash("dsa-seats:rapid-state-legislative-primary-context-row:v1", unsigned) });
    }
  }
  rows.sort((left, right) => byteCompare(left.state, right.state) || byteCompare(left.officeScope, right.officeScope) || left.cycleYear - right.cycleYear);
  const stateContext: StateContestationContext[] = [];
  for (const state of [...new Set(rows.map((row) => row.state))].sort(byteCompare)) {
    const latest = rows.filter((row) => row.state === state && row.formulaEligible).sort((left, right) => right.cycleYear - left.cycleYear)[0];
    if (!latest) continue;
    stateContext.push({ state, cycleYear: latest.cycleYear, sourceArtifactId: latest.sourceArtifactId, democraticContests: latest.democraticContests, contestedDemocraticContests: latest.contestedDemocraticContests, contestedShare: latest.contestedShare!, contestationScore: latest.contestationScore! });
  }
  const summary = {
    catalogs: ADAPTERS.length, rows: rows.length, formulaEligibleRows: rows.filter((row) => row.formulaEligible).length, statesWithContext: stateContext.length,
    democraticContests: rows.reduce((sum, row) => sum + row.democraticContests, 0), contestedDemocraticContests: rows.reduce((sum, row) => sum + row.contestedDemocraticContests, 0), democraticVotes: rows.reduce((sum, row) => sum + row.democraticVotes, 0),
  };
  const unsigned = {
    schema: "rapid-state-legislative-primary-context-v1" as const, version: 1 as const,
    methodology: { contestedDefinition: "more_than_one_named_candidate_in_a_democratic_contest" as const, contestationScale: "clamp(contested_share_percent / 40 * 100, 0, 100)" as const, stateSelection: "latest_cycle_with_uncontested_contests_recorded_per_state_legislative_catalog" as const, winnerInference: false as const, holderIdentity: "not_collected" as const },
    sourceIds: ADAPTERS.map((adapter) => adapter.id), rows, stateContext, summary,
    rowSetSha256: hash("dsa-seats:rapid-state-legislative-primary-context-row-set:v1", rows),
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-state-legislative-primary-context-package:v1", unsigned) };
}

export function validateStateLegislativePrimaryContext(value: unknown, root = process.cwd()): StateLegislativePrimaryContext {
  const expected = buildStateLegislativePrimaryContext(root);
  if (!exact(value, expected)) throw new Error("STATE_LEGISLATIVE_PRIMARY_CONTEXT_INVALID");
  return value as StateLegislativePrimaryContext;
}

export function readStateLegislativePrimaryContext(root = process.cwd(), lock: SourceLock = readSourceLock(root)): StateLegislativePrimaryContext {
  const { bytes } = readRetainedSource(lock, STATE_LEGISLATIVE_PRIMARY_CONTEXT.id, root);
  return validateStateLegislativePrimaryContext(JSON.parse(bytes.toString("utf8")), root);
}
