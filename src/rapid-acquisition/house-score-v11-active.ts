import { housePriorityBriefsV10, type PublicPriorityBrief } from "@/lib/house-priority-index";

import { readHouseIncumbentCandidacy, type OpenSeatSignal } from "./house-incumbent-candidacy";
import { republicanRouteScore } from "./house-score-v09-active";
import { readHouseScoreV10ActiveProjection } from "./house-score-v10-active";
import { readPinnedPackage, readSourceLock, type SourceLock } from "./intake/source-lock";
import { byteCompare, hash } from "./shared";

/**
 * House score v0.11: open-seat handling for incumbents who have filed for the
 * Senate in 2026 (the FEC candidate master, via house-incumbent-candidacy-v1).
 *
 * For those seats the incumbent-specific components are omitted and the
 * present weights renormalized, as the index does for any missing component:
 *   Democratic  cash and alignment omitted -> score = structural baseline
 *   Republican  cash omitted -> v0.9 route over competitiveness, local context, state contestation
 * The House committee's cash on hand is still reported, but it no longer
 * reads as incumbent vulnerability. Every other seat carries v0.10 unchanged.
 * Retirements and runs for state office are not visible in federal filings;
 * those seats are unchanged and the caveat stands.
 */
export interface HouseScoreV11ActiveRow {
  readonly seatCycleId: string;
  readonly districtLabel: string;
  readonly incumbentParty: "Democratic" | "Republican";
  readonly previousScoreVersion: "v0.10";
  readonly previousScore: number;
  readonly activeScoreVersion: "v0.11";
  readonly activeScore: number;
  readonly openSeatSignal: OpenSeatSignal;
  readonly senateCandidateIds: readonly string[];
  readonly omittedComponents: readonly string[];
  readonly movementFromV10: number;
  readonly parentV10RowSha256: string;
  readonly rowSha256: string;
}

export interface HouseScoreV11ActiveProjection {
  readonly schema: "house-score-v11-active-projection-v1";
  readonly version: 1;
  readonly methodology: Readonly<{ status: "active"; openSeatSource: "house-incumbent-candidacy-v1"; openSeatTreatment: "omit_incumbent_components_and_renormalize"; democraticOpenSeat: "structural_baseline_only"; republicanOpenSeat: "route_without_cash"; retirementsAndStateOffice: "not_observed_unchanged"; sourceWinnerInference: false }>;
  readonly parents: readonly Readonly<{ id: string; packageSha256: string }>[];
  readonly rows: readonly HouseScoreV11ActiveRow[];
  readonly summary: Readonly<{ seats: 430; openSeats: number; democraticOpenSeats: number; republicanOpenSeats: number; changedSeats: number; unchangedSeats: number; maxAbsoluteMovement: number }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const HOUSE_SCORE_V11 = {
  id: "house-score-v11-active-projection-v1",
  path: "data/metadata/house-score-v11-active-projection-v1.json",
  url: "urn:dsa-seats:house-score-v11-active-projection:v1",
  parentIds: ["house-score-v10-active-projection-v1", "house-incumbent-candidacy-v1"],
} as const;

const one = (value: number): number => Math.round(value * 10) / 10;
const fail = (code: string): never => { throw new Error(`HOUSE_V11_${code}`); };
const driver = (brief: PublicPriorityBrief, key: string): number | null => { const value = brief.scoreDrivers.find((item) => item.key === key)?.score; if (value === undefined) fail(`DRIVER_MISSING:${brief.districtLabel}:${key}`); return value as number | null; };

export function buildHouseScoreV11ActiveProjection(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseScoreV11ActiveProjection {
  const v10 = readHouseScoreV10ActiveProjection(root, lock);
  const candidacy = readHouseIncumbentCandidacy(root, lock);
  const parentById = new Map(v10.rows.map((row) => [row.seatCycleId, row]));
  const candidacyById = new Map(candidacy.rows.map((row) => [row.seatCycleId, row]));
  const v09 = new Map(readPinnedPackage<{ packageSha256: string; rows: readonly { seatCycleId: string; republicanRoute: { competitiveness: number; localContext: number | null; stateContestation: number | null } | null }[] }>(lock, "house-score-v09-active-projection-v1", "dsa-seats:house-score-v09-active-package:v1", root).value.rows.map((row) => [row.seatCycleId, row]));

  const rows = housePriorityBriefsV10().map((brief): HouseScoreV11ActiveRow => {
    const parent = parentById.get(brief.seatCycleId) ?? fail(`PARENT_MISSING:${brief.seatCycleId}`);
    const seat = candidacyById.get(brief.seatCycleId) ?? fail(`CANDIDACY_MISSING:${brief.seatCycleId}`);
    if (parent.activeScore !== brief.provisionalTargetScore) fail(`PARENT_JOIN_INVALID:${brief.seatCycleId}`);
    let activeScore = parent.activeScore;
    const omitted: string[] = [];
    if (seat.openSeatSignal !== null) {
      if (brief.incumbentParty === "Republican") {
        const route = v09.get(brief.seatCycleId)?.republicanRoute ?? fail(`ROUTE_MISSING:${brief.seatCycleId}`);
        activeScore = republicanRouteScore({ competitiveness: route.competitiveness, cashVulnerability: null, localContext: route.localContext, stateContestation: route.stateContestation }).score;
        omitted.push("cash_vulnerability");
      } else {
        if (driver(brief, "incumbent_alignment_gap") === null) fail(`ALIGNMENT_MISSING:${brief.seatCycleId}`);
        activeScore = one(brief.baselineTargetScore);
        omitted.push("incumbent_alignment_gap", "cash_vulnerability");
      }
    }
    const unsigned = {
      seatCycleId: brief.seatCycleId, districtLabel: brief.districtLabel, incumbentParty: brief.incumbentParty,
      previousScoreVersion: "v0.10" as const, previousScore: parent.activeScore, activeScoreVersion: "v0.11" as const, activeScore,
      openSeatSignal: seat.openSeatSignal, senateCandidateIds: seat.senateFilings.map((filing) => filing.candidateId), omittedComponents: omitted,
      movementFromV10: one(activeScore - parent.activeScore), parentV10RowSha256: parent.rowSha256,
    };
    return { ...unsigned, rowSha256: hash("dsa-seats:house-score-v11-active-row:v1", unsigned) };
  }).sort((left, right) => byteCompare(left.seatCycleId, right.seatCycleId));
  if (rows.length !== 430 || new Set(rows.map((row) => row.seatCycleId)).size !== 430) fail("CLOSURE_INVALID");
  const open = rows.filter((row) => row.openSeatSignal !== null), changed = rows.filter((row) => row.movementFromV10 !== 0);
  const summary = {
    seats: 430 as const, openSeats: open.length, democraticOpenSeats: open.filter((row) => row.incumbentParty === "Democratic").length, republicanOpenSeats: open.filter((row) => row.incumbentParty === "Republican").length,
    changedSeats: changed.length, unchangedSeats: rows.length - changed.length, maxAbsoluteMovement: one(Math.max(...rows.map((row) => Math.abs(row.movementFromV10)))),
  };
  const unsigned = {
    schema: "house-score-v11-active-projection-v1" as const, version: 1 as const,
    methodology: { status: "active" as const, openSeatSource: "house-incumbent-candidacy-v1" as const, openSeatTreatment: "omit_incumbent_components_and_renormalize" as const, democraticOpenSeat: "structural_baseline_only" as const, republicanOpenSeat: "route_without_cash" as const, retirementsAndStateOffice: "not_observed_unchanged" as const, sourceWinnerInference: false as const },
    parents: [{ id: "house-score-v10-active-projection-v1", packageSha256: v10.packageSha256 }, { id: "house-incumbent-candidacy-v1", packageSha256: candidacy.packageSha256 }],
    rows, summary, rowSetSha256: hash("dsa-seats:house-score-v11-active-row-set:v1", rows),
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:house-score-v11-active-package:v1", unsigned) };
}

export function readHouseScoreV11ActiveProjection(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseScoreV11ActiveProjection {
  const { value } = readPinnedPackage<HouseScoreV11ActiveProjection>(lock, HOUSE_SCORE_V11.id, "dsa-seats:house-score-v11-active-package:v1", root);
  if (value.schema !== "house-score-v11-active-projection-v1" || value.version !== 1 || value.methodology.status !== "active" || value.summary.seats !== 430 || !Array.isArray(value.rows) || value.rows.length !== 430) fail("PROJECTION_INVALID");
  return value;
}
