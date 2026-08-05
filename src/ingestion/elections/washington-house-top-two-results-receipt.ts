import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";

export const WASHINGTON_HOUSE_TOP_TWO_RESULTS_RECEIPT_V1 = "washington-house-top-two-results-receipt-v1" as const;
export const WASHINGTON_HOUSE_TOP_TWO_SOURCE_SELECTION_PACKAGE_SHA256 = "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb" as const;

const SOURCES = Object.freeze([
  {
    cycleYear: 2022 as const,
    retainedPath: "data/source/elections/primary-results/wa-2022-house-primary.csv",
    sourceUrl: "https://results.vote.wa.gov/results/20220802/export/20220802_congressional.csv",
    byteSize: 10929,
    fileSha256: "e6be25e87a37cf1e577c2678cd172083d860d25b7b9480ea0bd09ca73c72bfa8",
  },
  {
    cycleYear: 2024 as const,
    retainedPath: "data/source/elections/primary-results/wa-2024-house-primary.csv",
    sourceUrl: "https://results.vote.wa.gov/results/20240806/export/20240806_congressional.csv",
    byteSize: 9671,
    fileSha256: "244c1ebb89a9211e254e1115aacfe814f502b96a97552dff7791942c2eff8135",
  },
] as const);

type CycleYear = typeof SOURCES[number]["cycleYear"];
type InputBytes = Buffer | Uint8Array | string;
export type WashingtonHouseTopTwoResultsInput = Readonly<{ readonly 2022: InputBytes; readonly 2024: InputBytes }>;
export type WashingtonHouseTopTwoCandidate = Readonly<{ candidateName: string; partyPreference: string | null; votes: number; suppliedPercentage: number; isWriteIn: boolean }>;
export type WashingtonHouseTopTwoContest = Readonly<{
  contestId: string; contestSha256: string; cycleYear: CycleYear; stateCode: "WA"; districtCode: string; sourceRace: string;
  office: "U.S. Representative"; eventKind: "regular"; stage: "primary"; nominationSystem: "top_two";
  formulaApplicability: "confirmed_incompatible"; certificationStatus: "official_final_uncertified";
  candidates: readonly WashingtonHouseTopTwoCandidate[]; contestTotalVotes: number; scoreEligible: false; evaluatorValues: Readonly<{ priorPrimaryMargin: null; priorDemocraticPrimaryVotes: null; priorProgressivePrimaryShare: null }>;
}>;
export type WashingtonHouseTopTwoResultsReceipt = Readonly<{
  schema: typeof WASHINGTON_HOUSE_TOP_TWO_RESULTS_RECEIPT_V1; version: 1; reviewerOnly: true; publicationEligible: false;
  methodologyParent: Readonly<{ packageSha256: typeof WASHINGTON_HOUSE_TOP_TWO_SOURCE_SELECTION_PACKAGE_SHA256; disposition: "excluded_methodology" }>;
  originalPublisher: "Washington Secretary of State"; certificationStatus: "official_final_uncertified"; nominationSystem: "top_two"; formulaApplicability: "confirmed_incompatible";
  sources: readonly Readonly<{ cycleYear: CycleYear; retainedPath: string; sourceUrl: string; byteSize: number; fileSha256: string; sourceSha256: string }>[];
  contests: readonly WashingtonHouseTopTwoContest[]; summary: Readonly<{ cycles: 2; contests: 20; candidates: number; evaluatorNumericValues: 0; scoreEligibleContests: 0 }>;
  packageSha256: string;
}>;

export class WashingtonHouseTopTwoResultsReceiptError extends Error {
  constructor(readonly code: string) { super(`Washington House top-two receipt rejected: ${code}`); this.name = "WashingtonHouseTopTwoResultsReceiptError"; }
}

const fail = (code: string): never => { throw new WashingtonHouseTopTwoResultsReceiptError(code); };
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rawHash = (domain: string, bytes: Uint8Array): string => createHash("sha256").update(domain, "ascii").update(bytes).digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const csvHeader = ["Race", "Candidate", "Party", "Votes", "PercentageOfTotalVotes", "JurisdictionName"] as const;
const contestRace = /^congressional district ([1-9]|10) - u\.s\. representative$/i;

function bytes(value: InputBytes): Buffer {
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  return fail("INPUT_BYTES_INVALID");
}

/** Parses RFC-4180-style rows without accepting silent malformed quoting. */
function csvRows(text: string): string[][] {
  if (!text.length || text.includes("\u0000")) fail("CSV_TEXT_INVALID");
  const rows: string[][] = [], row: string[] = [];
  let field = "", quoted = false, atStart = true;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') { if (text[index + 1] === '"') { field += '"'; index += 1; } else quoted = false; }
      else field += char;
      continue;
    }
    if (atStart && char === '"') { quoted = true; atStart = false; continue; }
    if (char === ",") { row.push(field); field = ""; atStart = true; continue; }
    if (char === "\n") { row.push(field.endsWith("\r") ? field.slice(0, -1) : field); rows.push([...row]); row.length = 0; field = ""; atStart = true; continue; }
    if (char === '"') fail("CSV_UNQUOTED_QUOTE");
    field += char; atStart = false;
  }
  if (quoted) fail("CSV_UNTERMINATED_QUOTE");
  if (field.length || row.length) { row.push(field.endsWith("\r") ? field.slice(0, -1) : field); rows.push([...row]); }
  return rows;
}

function parseCycle(source: typeof SOURCES[number], input: InputBytes): { source: WashingtonHouseTopTwoResultsReceipt["sources"][number]; contests: WashingtonHouseTopTwoContest[] } {
  const file = bytes(input);
  if (file.byteLength !== source.byteSize || createHash("sha256").update(file).digest("hex") !== source.fileSha256) fail("SOURCE_FILE_RECEIPT_MISMATCH");
  const rows = csvRows(new TextDecoder("utf-8", { fatal: true }).decode(file));
  if (!rows.length || canonicalJson(rows[0]) !== canonicalJson(csvHeader)) fail("CSV_HEADER_INVALID");
  const candidates = new Map<string, WashingtonHouseTopTwoCandidate[]>();
  for (const row of rows.slice(1)) {
    if (row.length !== csvHeader.length) fail("CSV_COLUMN_COUNT_INVALID");
    const [race, candidateName, party, rawVotes, rawPercentage, jurisdiction] = row;
    const match = contestRace.exec(race!);
    if (!match) continue;
    if (jurisdiction !== "Congressional" || !candidateName || !rawVotes || !rawPercentage || !/^\d+$/.test(rawVotes) || !/^\d+(?:\.\d{1,2})?$/.test(rawPercentage)) fail("CSV_HOUSE_ROW_INVALID");
    const votes = Number(rawVotes), suppliedPercentage = Number(rawPercentage);
    if (!Number.isSafeInteger(votes) || votes < 0 || !Number.isFinite(suppliedPercentage) || suppliedPercentage < 0 || suppliedPercentage > 100) fail("CSV_HOUSE_VALUE_INVALID");
    const districtCode = match[1]!;
    const current = candidates.get(districtCode) ?? [];
    if (current.some((candidate) => candidate.candidateName === candidateName)) fail("CSV_DUPLICATE_CANDIDATE");
    current.push({ candidateName, partyPreference: party!.trim() || null, votes, suppliedPercentage, isWriteIn: candidateName === "WRITE-IN" });
    candidates.set(districtCode, current);
  }
  if (candidates.size !== 10 || [...candidates.keys()].sort(bytewise).join(",") !== "1,10,2,3,4,5,6,7,8,9") fail("HOUSE_CONTEST_COVERAGE_INVALID");
  const contests = [...candidates.entries()].map(([districtCode, rowsForContest]) => {
    if (!rowsForContest.some((candidate) => candidate.isWriteIn)) fail("HOUSE_WRITE_IN_MISSING");
    const contestTotalVotes = rowsForContest.reduce((total, candidate) => total + candidate.votes, 0);
    if (!Number.isSafeInteger(contestTotalVotes) || contestTotalVotes < 1 || rowsForContest.some((candidate) => Math.abs((candidate.votes / contestTotalVotes) * 100 - candidate.suppliedPercentage) > 0.005000001)) fail("HOUSE_PERCENTAGE_RECONCILIATION_MISMATCH");
    const unsigned = {
      contestId: `wa:${source.cycleYear}:us-house:${districtCode}`, cycleYear: source.cycleYear, stateCode: "WA" as const, districtCode,
      sourceRace: rowsForContest === candidates.get(districtCode) ? rows.find((row) => contestRace.exec(row[0]!)?.[1] === districtCode)?.[0] ?? fail("SOURCE_RACE_MISSING") : fail("SOURCE_RACE_MISSING"),
      office: "U.S. Representative" as const, eventKind: "regular" as const, stage: "primary" as const, nominationSystem: "top_two" as const,
      formulaApplicability: "confirmed_incompatible" as const, certificationStatus: "official_final_uncertified" as const,
      candidates: rowsForContest, contestTotalVotes, scoreEligible: false as const,
      evaluatorValues: { priorPrimaryMargin: null, priorDemocraticPrimaryVotes: null, priorProgressivePrimaryShare: null },
    };
    return { ...unsigned, contestSha256: hash("dsa-seats:wa-house-top-two-contest:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.contestId, right.contestId));
  return { source: { cycleYear: source.cycleYear, retainedPath: source.retainedPath, sourceUrl: source.sourceUrl, byteSize: source.byteSize, fileSha256: source.fileSha256, sourceSha256: rawHash("dsa-seats:wa-house-top-two-source:v1\0", file) }, contests };
}

export function parseWashingtonHouseTopTwoResultsReceipt(input: WashingtonHouseTopTwoResultsInput): WashingtonHouseTopTwoResultsReceipt {
  const parsed = SOURCES.map((source) => parseCycle(source, input[source.cycleYear]));
  const sources = parsed.map((item) => item.source);
  const contests = parsed.flatMap((item) => item.contests).sort((left, right) => bytewise(left.contestId, right.contestId));
  if (contests.length !== 20 || new Set(contests.map((contest) => contest.contestId)).size !== 20) fail("CONTEST_ID_CLOSURE_INVALID");
  const unsigned = {
    schema: WASHINGTON_HOUSE_TOP_TWO_RESULTS_RECEIPT_V1, version: 1 as const, reviewerOnly: true as const, publicationEligible: false as const,
    methodologyParent: { packageSha256: WASHINGTON_HOUSE_TOP_TWO_SOURCE_SELECTION_PACKAGE_SHA256, disposition: "excluded_methodology" as const },
    originalPublisher: "Washington Secretary of State" as const, certificationStatus: "official_final_uncertified" as const, nominationSystem: "top_two" as const, formulaApplicability: "confirmed_incompatible" as const,
    sources, contests, summary: { cycles: 2 as const, contests: 20 as const, candidates: contests.reduce((total, contest) => total + contest.candidates.length, 0), evaluatorNumericValues: 0 as const, scoreEligibleContests: 0 as const },
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:wa-house-top-two-package:v1\0", unsigned) };
}

export function validateWashingtonHouseTopTwoResultsReceipt(value: WashingtonHouseTopTwoResultsReceipt): WashingtonHouseTopTwoResultsReceipt {
  const { packageSha256, ...unsigned } = value;
  if (packageSha256 !== hash("dsa-seats:wa-house-top-two-package:v1\0", unsigned) || value.reviewerOnly !== true || value.publicationEligible !== false || value.methodologyParent.packageSha256 !== WASHINGTON_HOUSE_TOP_TWO_SOURCE_SELECTION_PACKAGE_SHA256 || value.methodologyParent.disposition !== "excluded_methodology" || value.originalPublisher !== "Washington Secretary of State" || value.certificationStatus !== "official_final_uncertified" || value.nominationSystem !== "top_two" || value.formulaApplicability !== "confirmed_incompatible" || value.sources.length !== 2 || value.contests.length !== 20 || value.summary.evaluatorNumericValues !== 0 || value.summary.scoreEligibleContests !== 0) fail("PACKAGE_INVARIANT_INVALID");
  for (const contest of value.contests) {
    const { contestSha256, ...contestUnsigned } = contest;
    const total = contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
    if (contestSha256 !== hash("dsa-seats:wa-house-top-two-contest:v1\0", contestUnsigned) || total !== contest.contestTotalVotes || contest.scoreEligible || contest.evaluatorValues.priorPrimaryMargin !== null || contest.evaluatorValues.priorDemocraticPrimaryVotes !== null || contest.evaluatorValues.priorProgressivePrimaryShare !== null || contest.candidates.some((candidate) => Math.abs((candidate.votes / total) * 100 - candidate.suppliedPercentage) > 0.005000001)) fail("CONTEST_INVARIANT_INVALID");
  }
  return value;
}
