import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateHousePrimaryProjection } from "./house-primary-projection";
import { validateHousePrimarySourceRegistry } from "./source-registry";

export interface StructuredPrimaryCandidate {
  readonly sourceCandidateKey: string;
  readonly sourceCandidateName: string;
  readonly rawParty: string;
  readonly votes: number;
  readonly sourceNameMarker: "none" | "trailing_asterisk";
  readonly winnerStatus: "not_marked_by_source";
}
export interface StructuredPrimaryContest {
  readonly contestId: string;
  readonly stateCode: "DE" | "HI" | "RI";
  readonly cycleYear: 2022 | 2024;
  readonly electionDate: string;
  readonly districtLabel: string;
  readonly sourceContestId: string;
  readonly sourceOfficeTitle: string;
  readonly rawParty: string;
  readonly resultAuthorityStatus: "official_result_bytes_retained_not_claimed_certified";
  readonly sourceWinnerStatus: "not_marked_by_source";
  readonly totalPrecincts: number | null;
  readonly reportingPrecincts: number | null;
  readonly totalVotes: number;
  readonly candidates: readonly StructuredPrimaryCandidate[];
  readonly sourceLockId: string;
  readonly contestSha256: string;
}
export interface StructuredPrimaryObservation {
  readonly observationId: string;
  readonly stateCode: "DE" | "HI" | "RI";
  readonly cycleYear: 2022 | 2024;
  readonly districtLabel: string;
  readonly status: "reported_contest" | "source_absent_no_disposition_inference";
  readonly contestId: string | null;
  readonly sourceLockId: string;
  readonly scoreEligible: false;
}
export interface StructuredPrimaryResults {
  readonly schema: "rapid-house-primary-structured-results-v1";
  readonly version: 1;
  readonly registrySha256: string;
  readonly parentProjectionPackageSha256: string;
  readonly sourceLockIds: readonly string[];
  readonly contests: readonly StructuredPrimaryContest[];
  readonly contestSetSha256: string;
  readonly observations: readonly StructuredPrimaryObservation[];
  readonly observationSetSha256: string;
  readonly summary: Readonly<{ observations: 10; reportedContests: 9; sourceAbsent: 1; candidateRows: 23; contestVotes: 643748; scoreEligibleRows: 0 }>;
  readonly packageSha256: string;
}

const byteCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("STRUCTURED_PRIMARY_CSV_UNTERMINATED_QUOTE");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((value) => value.some((item) => item.length));
}
const integer = (value: string, code: string) => { const number = Number(value); if (!/^\d+$/.test(value) || !Number.isSafeInteger(number)) throw new Error(code); return number; };
const candidate = (key: string, name: string, party: string, votes: number): StructuredPrimaryCandidate => ({ sourceCandidateKey: key, sourceCandidateName: name, rawParty: party, votes, sourceNameMarker: name.endsWith("*") ? "trailing_asterisk" : "none", winnerStatus: "not_marked_by_source" });
const finalize = (contest: Omit<StructuredPrimaryContest, "contestSha256">): StructuredPrimaryContest => ({ ...contest, contestSha256: hash("dsa-seats:rapid-house-primary-structured-contest:v1", contest) });

function parseDelaware(root: string, cycleYear: 2022 | 2024, electionDate: string): StructuredPrimaryContest[] {
  const sourceLockId = `de-${cycleYear}-primary-results`;
  const rows = csvRows(readFileSync(join(root, `data/source/rapid/house-primary/de/${cycleYear}/primary-results.csv`), "utf8"));
  const header = ["office", "candidatename", "partyname", "electiondate", "machinevotessum", "absenteevotessum", "earlyvotessum", "totalvotessum", "totalvotespercentage", "xmlreporttime", "electionname"];
  if (!exact(rows[0], header) || rows.length !== (cycleYear === 2022 ? 50 : 80) || rows.slice(1).some((row) => row.length !== header.length)) throw new Error("STRUCTURED_PRIMARY_DE_SCHEMA_INVALID");
  const matches = rows.slice(1).filter((row) => row[0] === "U.S. Representative in Congress" && row[2] === "Democratic Party");
  if (cycleYear === 2022) { if (matches.length) throw new Error("STRUCTURED_PRIMARY_DE_2022_ABSENCE_INVALID"); return []; }
  if (matches.length !== 3 || matches.some((row) => row[3]?.slice(0, 10) !== electionDate)) throw new Error("STRUCTURED_PRIMARY_DE_CONTEST_INVALID");
  const candidates = matches.map((row, index) => candidate(`de:${cycleYear}:al:${index + 1}`, row[1]!, row[2]!, integer(row[7]!, "STRUCTURED_PRIMARY_DE_VOTE_INVALID")));
  const totalVotes = candidates.reduce((sum, row) => sum + row.votes, 0);
  return [finalize({ contestId: `de:primary:${cycleYear}:al:democratic`, stateCode: "DE", cycleYear, electionDate, districtLabel: "DE-AL", sourceContestId: "U.S. Representative in Congress:Democratic Party", sourceOfficeTitle: "U.S. Representative in Congress", rawParty: "Democratic Party", resultAuthorityStatus: "official_result_bytes_retained_not_claimed_certified", sourceWinnerStatus: "not_marked_by_source", totalPrecincts: null, reportingPrecincts: null, totalVotes, candidates, sourceLockId })];
}

function parseHawaii(root: string, cycleYear: 2022 | 2024, electionDate: string): StructuredPrimaryContest[] {
  const sourceLockId = `hi-${cycleYear}-primary-summary`;
  const decoded = new TextDecoder("utf-16le", { fatal: true }).decode(readFileSync(join(root, `data/source/rapid/house-primary/hi/${cycleYear}/summary.txt`))).replace(/^\uFEFF/, "");
  const rows = csvRows(decoded);
  if (rows[0]?.[0] !== "Format#1" || rows[1]?.[0] !== "#Contest ID" || rows[1]?.[20] !== "Total Votes") throw new Error("STRUCTURED_PRIMARY_HI_SCHEMA_INVALID");
  const target = rows.slice(2).map((row) => row.at(-1) === "" ? row.slice(0, -1) : row).filter((row) => row[1]?.startsWith("U.S. Representative, Dist ") && row[4] === "D");
  const grouped = new Map<string, string[][]>(); for (const row of target) grouped.set(row[0]!, [...(grouped.get(row[0]!) ?? []), row]);
  if (grouped.size !== 2) throw new Error("STRUCTURED_PRIMARY_HI_CONTEST_CLOSURE_INVALID");
  return [...grouped.values()].map((contestRows) => {
    const title = contestRows[0]![1]!, district = title.endsWith("Dist I") ? "01" : title.endsWith("Dist II") ? "02" : null;
    if (!district || contestRows.some((row) => row.length !== 21 || row[1] !== title)) throw new Error("STRUCTURED_PRIMARY_HI_CONTEST_INVALID");
    const candidates = contestRows.map((row) => candidate(`${sourceLockId}:${row[0]}:${row[14]}`, row[15]!, row[4]!, integer(row[20]!, "STRUCTURED_PRIMARY_HI_VOTE_INVALID")));
    return finalize({ contestId: `hi:primary:${cycleYear}:${district}:democratic`, stateCode: "HI", cycleYear, electionDate, districtLabel: `HI-${district}`, sourceContestId: contestRows[0]![0]!, sourceOfficeTitle: title, rawParty: "D", resultAuthorityStatus: "official_result_bytes_retained_not_claimed_certified", sourceWinnerStatus: "not_marked_by_source", totalPrecincts: integer(contestRows[0]![12]!, "STRUCTURED_PRIMARY_HI_PRECINCT_INVALID"), reportingPrecincts: integer(contestRows[0]![13]!, "STRUCTURED_PRIMARY_HI_PRECINCT_INVALID"), totalVotes: candidates.reduce((sum, row) => sum + row.votes, 0), candidates, sourceLockId });
  });
}

function parseRhodeIsland(root: string, cycleYear: 2022 | 2024, electionDate: string): StructuredPrimaryContest[] {
  const sourceLockId = `ri-${cycleYear}-statewide-primary`;
  const value = JSON.parse(readFileSync(join(root, `data/source/rapid/house-primary/ri/${cycleYear}/statewide.json`), "utf8")) as Record<string, unknown>;
  if (value.election_date !== (cycleYear === 2022 ? "September 13, 2022" : "September 10, 2024") || !Array.isArray(value.contests)) throw new Error("STRUCTURED_PRIMARY_RI_SCHEMA_INVALID");
  const contests = (value.contests as Record<string, unknown>[]).filter((row) => /^DEM Representative in Congress District [12]$/.test(String(row.name)));
  if (contests.length !== 2) throw new Error("STRUCTURED_PRIMARY_RI_CONTEST_CLOSURE_INVALID");
  return contests.map((row) => {
    const name = String(row.name), district = name.endsWith("1") ? "01" : "02", rawCandidates = row.candidates;
    if (!Array.isArray(rawCandidates) || row.contest_party_designation !== "DEM") throw new Error("STRUCTURED_PRIMARY_RI_CONTEST_INVALID");
    const candidates = (rawCandidates as Record<string, unknown>[]).map((item, index) => candidate(`${sourceLockId}:${row.contest_number}:${index + 1}`, String(item.name), String(item.party_code), integer(String(item.votes), "STRUCTURED_PRIMARY_RI_VOTE_INVALID")));
    const totalVotes = integer(String(row.total_votes), "STRUCTURED_PRIMARY_RI_TOTAL_INVALID");
    if (candidates.reduce((sum, item) => sum + item.votes, 0) !== totalVotes) throw new Error("STRUCTURED_PRIMARY_RI_ARITHMETIC_INVALID");
    return finalize({ contestId: `ri:primary:${cycleYear}:${district}:democratic`, stateCode: "RI", cycleYear, electionDate, districtLabel: `RI-${district}`, sourceContestId: String(row.contest_number), sourceOfficeTitle: name, rawParty: "DEM", resultAuthorityStatus: "official_result_bytes_retained_not_claimed_certified", sourceWinnerStatus: "not_marked_by_source", totalPrecincts: integer(String(row.precinct_count), "STRUCTURED_PRIMARY_RI_PRECINCT_INVALID"), reportingPrecincts: integer(String(row.precincts_reporting), "STRUCTURED_PRIMARY_RI_PRECINCT_INVALID"), totalVotes, candidates, sourceLockId });
  });
}

export function buildStructuredPrimaryResults(root = process.cwd()): StructuredPrimaryResults {
  const projection = validateHousePrimaryProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v1.json"), "utf8")), root);
  const registryBytes = readFileSync(join(root, "data/rapid-acquisition/house-primary-source-registry-v1.json"));
  const registry = validateHousePrimarySourceRegistry(JSON.parse(registryBytes.toString("utf8")));
  const dates = new Map(registry.rows.map((row) => [`${row.stateCode}-${row.cycleYear}`, row.electionDate]));
  const contests = [
    ...parseDelaware(root, 2022, dates.get("DE-2022")!), ...parseDelaware(root, 2024, dates.get("DE-2024")!),
    ...parseHawaii(root, 2022, dates.get("HI-2022")!), ...parseHawaii(root, 2024, dates.get("HI-2024")!),
    ...parseRhodeIsland(root, 2022, dates.get("RI-2022")!), ...parseRhodeIsland(root, 2024, dates.get("RI-2024")!),
  ].sort((left, right) => byteCompare(left.contestId, right.contestId));
  const expected = [
    ["DE", 2022, "DE-AL"], ["DE", 2024, "DE-AL"],
    ["HI", 2022, "HI-01"], ["HI", 2022, "HI-02"], ["HI", 2024, "HI-01"], ["HI", 2024, "HI-02"],
    ["RI", 2022, "RI-01"], ["RI", 2022, "RI-02"], ["RI", 2024, "RI-01"], ["RI", 2024, "RI-02"],
  ] as const;
  const observations = expected.map(([stateCode, cycleYear, districtLabel]) => { const contest = contests.find((item) => item.stateCode === stateCode && item.cycleYear === cycleYear && item.districtLabel === districtLabel); const sourceLockId = `${stateCode.toLowerCase()}-${cycleYear}-${stateCode === "RI" ? "statewide-primary" : stateCode === "HI" ? "primary-summary" : "primary-results"}`; return { observationId: `${stateCode.toLowerCase()}:structured-primary:${cycleYear}:${districtLabel.slice(3).toLowerCase()}`, stateCode, cycleYear, districtLabel, status: contest ? "reported_contest" as const : "source_absent_no_disposition_inference" as const, contestId: contest?.contestId ?? null, sourceLockId, scoreEligible: false as const }; });
  const sourceLockIds = [...new Set(contests.map((row) => row.sourceLockId).concat("de-2022-primary-results"))].sort(byteCompare);
  if (contests.length !== 9 || observations.length !== 10 || observations.filter((row) => row.status === "reported_contest").length !== 9 || observations.filter((row) => row.status === "source_absent_no_disposition_inference").length !== 1 || sourceLockIds.length !== 6 || contests.flatMap((row) => row.candidates).length !== 23 || contests.reduce((sum, row) => sum + row.totalVotes, 0) !== 643748) throw new Error("STRUCTURED_PRIMARY_RESULTS_CLOSURE_INVALID");
  const contestSetSha256 = hash("dsa-seats:rapid-house-primary-structured-contest-set:v1", contests), observationSetSha256 = hash("dsa-seats:rapid-house-primary-structured-observation-set:v1", observations);
  const summary = { observations: 10 as const, reportedContests: 9 as const, sourceAbsent: 1 as const, candidateRows: 23 as const, contestVotes: 643748 as const, scoreEligibleRows: 0 as const };
  const unsigned = { schema: "rapid-house-primary-structured-results-v1" as const, version: 1 as const, registrySha256: projection.registrySha256, parentProjectionPackageSha256: projection.packageSha256, sourceLockIds, contests, contestSetSha256, observations, observationSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-structured-package:v1", unsigned) };
}

export function validateStructuredPrimaryResults(value: unknown, root = process.cwd()): StructuredPrimaryResults {
  const expected = buildStructuredPrimaryResults(root);
  if (!exact(value, expected)) throw new Error("STRUCTURED_PRIMARY_RESULTS_INVALID");
  return value as StructuredPrimaryResults;
}
