import { housePriorityBriefs, type PublicPriorityBrief } from "@/lib/house-priority-index";
import { cashVulnerabilityScore } from "@/lib/seat-score";

import { readFecCandidateSummary, type FecCandidateSummaryRow } from "./fec-candidate-summary";
import { readHouseScoreV09ActiveProjection, republicanRouteScore } from "./house-score-v09-active";
import { readPinnedPackage, readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { readRefreshInputs, REFRESH_INPUTS } from "./refresh-inputs";
import { byteCompare, hash } from "./shared";

/**
 * House score v0.10: incumbent finance refreshed from the FEC candidate
 * summary snapshot named by the refresh pointer.
 *
 * Every other component is carried from v0.9 unchanged. For each seat the
 * incumbent's FEC candidate ids (Congress Legislators) are looked up in the
 * snapshot; the row with the latest coverage end date supplies cash on hand,
 * receipts, and disbursements. Seats without a snapshot row keep the retained
 * release aggregate and say so. The score is recomputed with the v0.9
 * formulas: Democratic 0.65 structural + 0.20 alignment + 0.15 cash
 * (renormalized when cash is missing), Republican coverage-scaled route.
 * Before applying the new cash, the builder reproduces each v0.9 score from
 * the old cash, so a formula drift fails the build instead of shifting scores.
 */
export type FinanceSource = "fec_candidate_summary" | "release_aggregate_retained";

export interface HouseScoreV10ActiveRow {
  readonly seatCycleId: string;
  readonly districtLabel: string;
  readonly incumbentParty: "Democratic" | "Republican";
  readonly previousScoreVersion: "v0.9";
  readonly previousScore: number;
  readonly activeScoreVersion: "v0.10";
  readonly activeScore: number;
  readonly financeSource: FinanceSource;
  readonly fecCandidateId: string | null;
  readonly previousCashOnHand: number | null;
  readonly cashOnHand: number | null;
  readonly receipts: number | null;
  readonly disbursements: number | null;
  readonly previousFinanceCoverageThrough: string | null;
  readonly financeCoverageThrough: string | null;
  readonly previousCashVulnerability: number | null;
  readonly cashVulnerability: number | null;
  readonly movementFromV09: number;
  readonly parentV09RowSha256: string;
  readonly rowSha256: string;
}

export interface HouseScoreV10ActiveProjection {
  readonly schema: "house-score-v10-active-projection-v1";
  readonly version: 1;
  readonly methodology: Readonly<{ status: "active"; financeSource: string; financeSnapshotDate: string; structuralInputs: "v0.9_carried_unchanged"; democraticFormula: "0.65_structural+0.20_alignment+0.15_cash_renormalized_when_cash_missing"; republicanFormula: "v0.9_coverage_scaled_route_with_refreshed_cash"; priorScoreReproductionCheck: true; sourceWinnerInference: false }>;
  readonly parents: readonly Readonly<{ id: string; packageSha256: string | null }>[];
  readonly rows: readonly HouseScoreV10ActiveRow[];
  readonly summary: Readonly<{ seats: 430; refreshedSeats: number; retainedFinanceSeats: number; changedSeats: number; unchangedSeats: number; maxAbsoluteMovement: number; democraticMaxScore: number; republicanMaxScore: number; latestCoverageThrough: string | null }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const HOUSE_SCORE_V10 = {
  id: "house-score-v10-active-projection-v1",
  path: "data/metadata/house-score-v10-active-projection-v1.json",
  url: "urn:dsa-seats:house-score-v10-active-projection:v1",
  // Literal parent id: naming HOUSE_SCORE_V09 here would evaluate during the v0.9 module's own import cycle.
  staticParentIds: ["house-score-v09-active-projection-v1", "congress-legislators-current-20260804", REFRESH_INPUTS.id],
  parentIds: (root: string, lock: SourceLock): string[] => [...HOUSE_SCORE_V10.staticParentIds, readRefreshInputs(root, lock).fecCandidateSummaryId],
} as const;

type Legislator = { id?: { bioguide?: string; fec?: string[] } };
const one = (value: number): number => Math.round(value * 10) / 10;
const fail = (code: string): never => { throw new Error(`HOUSE_V10_${code}`); };
const driver = (brief: PublicPriorityBrief, key: string): number | null => { const value = brief.scoreDrivers.find((item) => item.key === key)?.score; if (value === undefined) fail(`DRIVER_MISSING:${brief.districtLabel}:${key}`); return value as number | null; };
const democraticScore = (structural: number, alignment: number, cash: number | null): number => cash === null ? one((0.65 * structural + 0.2 * alignment) / 0.85) : one(0.65 * structural + 0.2 * alignment + 0.15 * cash);

export function buildHouseScoreV10ActiveProjection(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseScoreV10ActiveProjection {
  const inputs = readRefreshInputs(root, lock);
  const v09 = readHouseScoreV09ActiveProjection(root, lock);
  const finance = readFecCandidateSummary(lock, inputs.fecCandidateSummaryId, root);
  const congress = JSON.parse(readRetainedSource(lock, "congress-legislators-current-20260804", root).bytes.toString("utf8")) as Legislator[];
  const fecIds = new Map(congress.flatMap((person) => person.id?.bioguide ? [[person.id.bioguide, (person.id.fec ?? []).filter((id) => id.startsWith("H"))] as const] : []));
  const parentById = new Map(v09.rows.map((row) => [row.seatCycleId, row]));

  const rows = housePriorityBriefs().map((brief): HouseScoreV10ActiveRow => {
    const parent = parentById.get(brief.seatCycleId) ?? fail(`PARENT_MISSING:${brief.seatCycleId}`);
    if (parent.activeScore !== brief.provisionalTargetScore || parent.districtLabel !== brief.districtLabel) fail(`PARENT_JOIN_INVALID:${brief.seatCycleId}`);
    const previousCash = brief.incumbentCashOnHand, previousVulnerability = previousCash === null ? null : cashVulnerabilityScore(previousCash);
    const candidates = (fecIds.get(brief.bioguideId) ?? []).map((id) => finance.get(id)).filter((row): row is FecCandidateSummaryRow => row !== undefined).sort((left, right) => byteCompare(right.coverageEndDate ?? "", left.coverageEndDate ?? "") || byteCompare(left.candidateId, right.candidateId));
    const fec = candidates[0] ?? null;
    const cash = fec ? fec.cashOnHandClose : previousCash, vulnerability = cash === null ? null : cashVulnerabilityScore(cash);
    let reproduced: number, activeScore: number;
    if (brief.incumbentParty === "Republican") {
      const route = parent.republicanRoute ?? fail(`ROUTE_MISSING:${brief.seatCycleId}`);
      reproduced = republicanRouteScore({ competitiveness: route.competitiveness, cashVulnerability: previousVulnerability, localContext: route.localContext, stateContestation: route.stateContestation }).score;
      activeScore = republicanRouteScore({ competitiveness: route.competitiveness, cashVulnerability: vulnerability, localContext: route.localContext, stateContestation: route.stateContestation }).score;
    } else {
      const alignment = driver(brief, "incumbent_alignment_gap") ?? fail(`ALIGNMENT_MISSING:${brief.seatCycleId}`);
      reproduced = democraticScore(brief.baselineTargetScore, alignment, previousVulnerability);
      activeScore = democraticScore(brief.baselineTargetScore, alignment, vulnerability);
    }
    if (reproduced !== parent.activeScore) fail(`PRIOR_SCORE_NOT_REPRODUCED:${brief.seatCycleId}:${reproduced}!=${parent.activeScore}`);
    const unsigned = {
      seatCycleId: brief.seatCycleId, districtLabel: brief.districtLabel, incumbentParty: brief.incumbentParty,
      previousScoreVersion: "v0.9" as const, previousScore: parent.activeScore, activeScoreVersion: "v0.10" as const, activeScore,
      financeSource: (fec ? "fec_candidate_summary" : "release_aggregate_retained") as FinanceSource,
      fecCandidateId: fec?.candidateId ?? null,
      previousCashOnHand: previousCash, cashOnHand: cash,
      receipts: fec ? fec.totalReceipts : brief.incumbentReceipts, disbursements: fec ? fec.totalDisbursements : brief.incumbentDisbursements,
      previousFinanceCoverageThrough: brief.financeCoverageThrough, financeCoverageThrough: fec ? fec.coverageEndDate : brief.financeCoverageThrough,
      previousCashVulnerability: previousVulnerability, cashVulnerability: vulnerability,
      movementFromV09: one(activeScore - parent.activeScore), parentV09RowSha256: parent.rowSha256,
    };
    return { ...unsigned, rowSha256: hash("dsa-seats:house-score-v10-active-row:v1", unsigned) };
  }).sort((left, right) => byteCompare(left.seatCycleId, right.seatCycleId));

  if (rows.length !== 430 || new Set(rows.map((row) => row.seatCycleId)).size !== 430) fail("CLOSURE_INVALID");
  const changed = rows.filter((row) => row.movementFromV09 !== 0), refreshed = rows.filter((row) => row.financeSource === "fec_candidate_summary");
  const coverage = rows.map((row) => row.financeCoverageThrough).filter((value): value is string => value !== null).sort(byteCompare);
  const summary = {
    seats: 430 as const, refreshedSeats: refreshed.length, retainedFinanceSeats: rows.length - refreshed.length,
    changedSeats: changed.length, unchangedSeats: rows.length - changed.length,
    maxAbsoluteMovement: one(Math.max(...rows.map((row) => Math.abs(row.movementFromV09)))),
    democraticMaxScore: one(Math.max(...rows.filter((row) => row.incumbentParty === "Democratic").map((row) => row.activeScore))),
    republicanMaxScore: one(Math.max(...rows.filter((row) => row.incumbentParty === "Republican").map((row) => row.activeScore))),
    latestCoverageThrough: coverage.at(-1) ?? null,
  };
  const unsigned = {
    schema: "house-score-v10-active-projection-v1" as const, version: 1 as const,
    methodology: { status: "active" as const, financeSource: inputs.fecCandidateSummaryId, financeSnapshotDate: inputs.snapshotDate, structuralInputs: "v0.9_carried_unchanged" as const, democraticFormula: "0.65_structural+0.20_alignment+0.15_cash_renormalized_when_cash_missing" as const, republicanFormula: "v0.9_coverage_scaled_route_with_refreshed_cash" as const, priorScoreReproductionCheck: true as const, sourceWinnerInference: false as const },
    parents: [{ id: "house-score-v09-active-projection-v1", packageSha256: v09.packageSha256 }, { id: inputs.fecCandidateSummaryId, packageSha256: null }, { id: REFRESH_INPUTS.id, packageSha256: null }],
    rows, summary, rowSetSha256: hash("dsa-seats:house-score-v10-active-row-set:v1", rows),
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:house-score-v10-active-package:v1", unsigned) };
}

export function readHouseScoreV10ActiveProjection(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseScoreV10ActiveProjection {
  const { value } = readPinnedPackage<HouseScoreV10ActiveProjection>(lock, HOUSE_SCORE_V10.id, "dsa-seats:house-score-v10-active-package:v1", root);
  if (value.schema !== "house-score-v10-active-projection-v1" || value.version !== 1 || value.methodology.status !== "active" || value.methodology.priorScoreReproductionCheck !== true || value.summary.seats !== 430 || !Array.isArray(value.rows) || value.rows.length !== 430 || new Set(value.rows.map((row) => row.seatCycleId)).size !== 430) fail("PROJECTION_INVALID");
  return value;
}

export function validateHouseScoreV10ActiveProjection(value: unknown, root = process.cwd()): HouseScoreV10ActiveProjection {
  const expected = buildHouseScoreV10ActiveProjection(root);
  if ((value as HouseScoreV10ActiveProjection)?.packageSha256 !== expected.packageSha256) fail("ACTIVE_INVALID");
  return value as HouseScoreV10ActiveProjection;
}
