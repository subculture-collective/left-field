import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RapidExpansionStatus = Readonly<{
  shadow: Readonly<{
    seats: number;
    localContextEligibleSeats: number;
    localContextIneligibleSeats: number;
    activationEligible: false;
    eligibleDistricts: readonly Readonly<{ districtLabel: string; activeScore: number; shadowScore: number; movement: number; localContext: number }>[];
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
  shadow: { id: "house-score-v04-shadow-projection-v1", path: "data/metadata/house-score-v04-shadow-projection-v1.json", bytes: 540469, sha256: "9f11120f810c8eebb5f1c13e069113e3cbfa965c5db4930f89ba698f13dbc80b" },
  countyOffice: { id: "rapid-indiana-county-commissioner-primary-results-v1", path: "data/metadata/rapid-indiana-county-commissioner-primary-results-v1.json", bytes: 275292, sha256: "a64a49674816bcf2e9c40c705b8e4355301dbbaff43d6545d748b4beeb05d70c" },
} as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
// Paths are an exact allowlist above. Ignore dynamic tracing because `root` exists only for fixture isolation.
const readAllowlisted = (path: string) => readFile(/*turbopackIgnore: true*/ path);

export async function loadRapidExpansionStatus(root = process.cwd()): Promise<RapidExpansionStatus | null> {
  try {
    const [lockBytes, shadowBytes, countyOfficeBytes] = await Promise.all([readAllowlisted(join(/*turbopackIgnore: true*/ root, "data/source-lock.json")), readAllowlisted(join(/*turbopackIgnore: true*/ root, files.shadow.path)), readAllowlisted(join(/*turbopackIgnore: true*/ root, files.countyOffice.path))]);
    const lock = JSON.parse(lockBytes.toString("utf8")) as { entries?: readonly { id?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown }[] };
    for (const [key, bytes] of [["shadow", shadowBytes], ["countyOffice", countyOfficeBytes]] as const) {
      const file = files[key], matches = lock.entries?.filter((entry) => entry.id === file.id) ?? [];
      if (bytes.length !== file.bytes || sha(bytes) !== file.sha256 || matches.length !== 1 || matches[0]!.retainedPath !== file.path || matches[0]!.retainedStatus !== "retained" || matches[0]!.byteSize !== file.bytes || matches[0]!.sha256 !== file.sha256) return null;
    }
    const shadow = JSON.parse(shadowBytes.toString("utf8")) as { schema?: unknown; summary?: Record<string, unknown>; rows?: readonly Record<string, unknown>[] };
    const countyOffice = JSON.parse(countyOfficeBytes.toString("utf8")) as { schema?: unknown; summary?: Record<string, unknown> };
    if (shadow.schema !== "house-score-v04-shadow-projection-v1" || countyOffice.schema !== "rapid-indiana-county-commissioner-primary-results-v1" || !shadow.summary || !Array.isArray(shadow.rows) || !countyOffice.summary) return null;
    const eligible = shadow.rows.filter((row) => row.localContext !== null).map((row) => ({ districtLabel: row.districtLabel as string, activeScore: row.activeScore as number, shadowScore: row.shadowScore as number, movement: row.movement as number, localContext: row.localContext as number }));
    if (shadow.summary.seats !== 430 || shadow.summary.localContextEligibleSeats !== 3 || shadow.summary.localContextIneligibleSeats !== 427 || shadow.summary.activationEligible !== false || eligible.length !== 3 || eligible.some((row) => !/^[A-Z]{2}-AL$/.test(row.districtLabel) || ![row.activeScore, row.shadowScore, row.movement, row.localContext].every(Number.isFinite))) return null;
    const expectedCounty = { officeRows: 179, partyContests: 226, candidateRows: 376, exactCountyOfficeRows: 163, unmappedOfficeRows: 16, formulaEligibleContests: 0 } as const;
    if (Object.entries(expectedCounty).some(([key, value]) => countyOffice.summary![key] !== value)) return null;
    return { shadow: { seats: 430, localContextEligibleSeats: 3, localContextIneligibleSeats: 427, activationEligible: false, eligibleDistricts: eligible }, countyOffice: expectedCounty };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; return null; }
}
