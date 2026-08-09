import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RapidExpansionStatus = Readonly<{
  score: Readonly<{
    seats: number;
    localContextActiveSeats: number;
    downBallotActiveSeats: number;
    unchangedSeats: number;
    geographyExcludedSeats: number;
    version: "v0.5";
    activeDistricts: readonly Readonly<{ districtLabel: string; previousScore: number; activeScore: number; movement: number; localContext: number; houseMinusPresidentPercentagePoints: number }>[];
  }>;
  countyOffice: Readonly<{
    officeRows: number;
    partyContests: number;
    candidateRows: number;
    exactCountyOfficeRows: number;
    unmappedOfficeRows: number;
    formulaEligibleContests: 0;
  }>;
}>;

const files = {
  score: { id: "house-score-v05-active-projection-v1", path: "data/metadata/house-score-v05-active-projection-v1.json", bytes: 431813, sha256: "ffca4e473569876bc54044d778e7d804308b485f00034f5c86e56c00a597df74" },
  countyOffice: { id: "rapid-indiana-county-commissioner-primary-results-v1", path: "data/metadata/rapid-indiana-county-commissioner-primary-results-v1.json", bytes: 275292, sha256: "a64a49674816bcf2e9c40c705b8e4355301dbbaff43d6545d748b4beeb05d70c" },
} as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
// Paths are an exact allowlist above. Ignore dynamic tracing because `root` exists only for fixture isolation.
const readAllowlisted = (path: string) => readFile(/*turbopackIgnore: true*/ path);

export async function loadRapidExpansionStatus(root = process.cwd()): Promise<RapidExpansionStatus | null> {
  try {
    const [lockBytes, scoreBytes, countyOfficeBytes] = await Promise.all([readAllowlisted(join(/*turbopackIgnore: true*/ root, "data/source-lock.json")), readAllowlisted(join(/*turbopackIgnore: true*/ root, files.score.path)), readAllowlisted(join(/*turbopackIgnore: true*/ root, files.countyOffice.path))]);
    const lock = JSON.parse(lockBytes.toString("utf8")) as { entries?: readonly { id?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown }[] };
    for (const [key, bytes] of [["score", scoreBytes], ["countyOffice", countyOfficeBytes]] as const) {
      const file = files[key], matches = lock.entries?.filter((entry) => entry.id === file.id) ?? [];
      if (bytes.length !== file.bytes || sha(bytes) !== file.sha256 || matches.length !== 1 || matches[0]!.retainedPath !== file.path || matches[0]!.retainedStatus !== "retained" || matches[0]!.byteSize !== file.bytes || matches[0]!.sha256 !== file.sha256) return null;
    }
    const score = JSON.parse(scoreBytes.toString("utf8")) as { schema?: unknown; summary?: Record<string, unknown>; rows?: readonly Record<string, unknown>[] };
    const countyOffice = JSON.parse(countyOfficeBytes.toString("utf8")) as { schema?: unknown; summary?: Record<string, unknown> };
    if (score.schema !== "house-score-v05-active-projection-v1" || countyOffice.schema !== "rapid-indiana-county-commissioner-primary-results-v1" || !score.summary || !Array.isArray(score.rows) || !countyOffice.summary) return null;
    const active = score.rows.filter((row) => row.downBallotDemocraticOverperformance !== null).map((row) => ({ districtLabel: row.districtLabel as string, previousScore: row.previousScore as number, activeScore: row.activeScore as number, movement: row.movementFromV04 as number, localContext: row.localContext as number, houseMinusPresidentPercentagePoints: row.houseMinusPresidentPercentagePoints as number }));
    if (score.summary.seats !== 430 || score.summary.downBallotActiveSeats !== 2 || score.summary.unchangedSeats !== 428 || score.summary.geographyExcludedSeats !== 1 || active.length !== 2 || active.some((row) => !/^[A-Z]{2}-AL$/.test(row.districtLabel) || ![row.previousScore, row.activeScore, row.movement, row.localContext, row.houseMinusPresidentPercentagePoints].every(Number.isFinite))) return null;
    const expectedCounty = { officeRows: 179, partyContests: 226, candidateRows: 376, exactCountyOfficeRows: 163, unmappedOfficeRows: 16, formulaEligibleContests: 0 } as const;
    if (Object.entries(expectedCounty).some(([key, value]) => countyOffice.summary![key] !== value)) return null;
    return { score: { seats: 430, localContextActiveSeats: 3, downBallotActiveSeats: 2, unchangedSeats: 428, geographyExcludedSeats: 1, version: "v0.5", activeDistricts: active }, countyOffice: expectedCounty };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; return null; }
}
