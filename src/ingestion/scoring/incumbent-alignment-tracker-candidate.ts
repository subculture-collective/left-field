import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { z } from "zod";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const LEFT_ID = "congressional-democrat-left-tracker-119th-house-20260804";
const PALESTINE_ID = "congressional-democrat-palestine-tracker-119th-house-20260730";
const PROJECTION_ID = "dsa-target-factual-projection-20260804-v1";
const LEFT_HASH = "f7b55863e7cf6528c87796cf2f955f1bf3ac588db4e76bb51b88817591be99ff";
const PALESTINE_HASH = "e90ee9bfa19052fc506d706aa98c9c1f48a392115b430ff392c175255f18e9d5";
const PROJECTION_HASH = "e1c2ab02cafb2ee438ec1a1c936f903e38cc19553d187b6b2d1dca55dc99d3ec";
const OUTPUT_HASH = "2cbab7bdec9688c2e07dc6434507f114db4da1d7d4ad2803026f0740c994b8b0";
const OUTPUT_BYTES = 144944;
const PACKAGE_HASH = "8644c752e1031cdc5b391daee51b94d972c053a2e6b72458bfb7378d147eb22f";
const ROW_SET_HASH = "30cda96506b6bca460a1e64cac0fc0011e4d31bf88e11a77b01f03bed0fbd95f";
const order = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const sha = (value: Buffer | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const fail = (message: string): never => { throw new Error(`INCUMBENT_ALIGNMENT_${message}`); };
const decode = (value: string): string => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textNodes = (value: string): string => [...value.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decode(match[1]!)).join("");
const round = (value: number): number => Math.round(value * 10) / 10;

type LockEntry = Readonly<{ id: string; url: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string; parentIds: readonly string[] }>;
type Projection = Readonly<{ seats: readonly Readonly<{ seatCycleId: string; stateCode: string; districtCode: string }>[] }>;

const expectedLocks = [
  { id: LEFT_ID, url: "https://docs.google.com/spreadsheets/d/1gPBdBrqVCbtuy7f1bjOdCDUzEv5RqbbU1yYAr3KoHYE", path: "data/source/scoring/incumbent-alignment/congressional-democrat-left-tracker-119th-house.xlsx", bytes: 1540131, sha256: LEFT_HASH, kind: "source", parents: [] },
  { id: PALESTINE_ID, url: "https://docs.google.com/spreadsheets/d/1VU1y_jSb2hanU2MrLsjRx8tujB-C--UAQ2EahaTXGUo", path: "data/source/scoring/incumbent-alignment/congressional-democrat-palestine-tracker-119th-house.xlsx", bytes: 485731, sha256: PALESTINE_HASH, kind: "source", parents: [] },
  { id: PROJECTION_ID, url: "urn:dsa-seats:dsa-target-factual-projection:v1:2026-08-04", path: "data/metadata/dsa-target-factual-projection-20260804-v1.json", bytes: 161915, sha256: PROJECTION_HASH, kind: "production_projection_receipt", parents: [] },
] as const;

function validateLocks(sourceLock: Readonly<{ entries: readonly LockEntry[] }>, outputRequired: boolean): void {
  const output = { id: "incumbent-alignment-tracker-candidate-20260807-v1", url: "urn:dsa-seats:incumbent-alignment-tracker-candidate:v1:2026-08-07", path: "data/metadata/incumbent-alignment-tracker-candidate-20260807-v1.json", bytes: OUTPUT_BYTES, sha256: OUTPUT_HASH, kind: "review_candidate", parents: [PROJECTION_ID, LEFT_ID, PALESTINE_ID] } as const;
  for (const expected of [...expectedLocks, ...(outputRequired ? [output] : [])]) {
    const rows = sourceLock.entries.filter((entry) => entry.id === expected.id);
    if (rows.length !== 1) fail("SOURCE_LOCK_MISSING");
    const row = rows[0]!;
    if (row.url !== expected.url || row.retainedPath !== expected.path || row.retainedStatus !== "retained" || row.byteSize !== expected.bytes || row.sha256 !== expected.sha256 || row.kind !== expected.kind || canonicalJson(row.parentIds) !== canonicalJson(expected.parents)) fail("SOURCE_LOCK_MISMATCH");
  }
}

function workbookCells(value: Buffer, wantedSheet: string): Map<string, string> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(value)); } catch { return fail("XLSX_INVALID"); }
  const read = (name: string): string => { const bytes = files[name]; return bytes ? Buffer.from(bytes).toString("utf8") : fail(`XLSX_PART_MISSING:${name}`); };
  const workbook = read("xl/workbook.xml"), relationships = read("xl/_rels/workbook.xml.rels");
  const sheet = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].map((match) => match[1]!).find((attrs) => decode(attrs.match(/\bname="([^"]+)"/)?.[1] ?? "") === wantedSheet);
  const relationshipId = sheet?.match(/(?:\br:id|\bid)="([^"]+)"/)?.[1];
  const relation = [...relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].map((match) => match[1]!).find((attrs) => attrs.match(/\bId="([^"]+)"/)?.[1] === relationshipId);
  const target = relation?.match(/\bTarget="([^"]+)"/)?.[1] ?? fail("SHEET_MISSING");
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const shared = files["xl/sharedStrings.xml"] ? [...read("xl/sharedStrings.xml").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]!)) : [];
  const cells = new Map<string, string>();
  for (const match of read(path).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = match[1]!, body = match[2] ?? "", ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1] ?? fail("CELL_REFERENCE_INVALID");
    const type = attrs.match(/\bt="([^"]+)"/)?.[1], raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
    const value = type === "s" ? shared[Number(raw)] ?? fail("SHARED_STRING_INVALID") : type === "inlineStr" ? textNodes(body) : raw === undefined ? "" : decode(raw);
    cells.set(ref, value);
  }
  return cells;
}

const numeric = (value: string, allowNa = false): number | null => {
  if (allowNa && value === "N/A") return null;
  const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) fail("SCORE_INVALID"); return parsed;
};
const district = (value: string): string => /^[A-Z]{2}-(?:\d{2}|AL)$/.test(value.trim()) ? value.trim() : fail("DISTRICT_INVALID");
const nameKey = (...parts: string[]): string => parts.join(" ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const incumbentAlignmentTrackerCandidateSchema = z.strictObject({
  schema: z.literal("incumbent-alignment-tracker-candidate-v1"), version: z.literal(1), generatedAt: z.literal("2026-08-07T16:00:00.000Z"), sourceCutoff: z.literal("2026-08-04"), reviewerOnly: z.literal(true), publicationEligible: z.literal(false),
  assumption: z.strictObject({ status: z.literal("owner_directed_assumed_correct_for_deadline"), scope: z.literal("provisional_score_calculation_only"), reviewerIdentityRecorded: z.literal(false), approvalFabricated: z.literal(false) }),
  sources: z.tuple([
    z.strictObject({ sourceLockId: z.literal(LEFT_ID), driveFileId: z.literal("1gPBdBrqVCbtuy7f1bjOdCDUzEv5RqbbU1yYAr3KoHYE"), modifiedTime: z.literal("2026-08-04T19:39:13.817Z"), fileSha256: z.literal(LEFT_HASH), sheet: z.literal("119th House"), scoreColumn: z.literal("Total Left Score") }),
    z.strictObject({ sourceLockId: z.literal(PALESTINE_ID), driveFileId: z.literal("1VU1y_jSb2hanU2MrLsjRx8tujB-C--UAQ2EahaTXGUo"), modifiedTime: z.literal("2026-07-30T17:48:22.629Z"), fileSha256: z.literal(PALESTINE_HASH), sheet: z.literal("119th House"), scoreColumn: z.literal("Total Palestine Score") }),
  ]),
  methodology: z.strictObject({ leftWeight: z.literal(50), palestineWeight: z.literal(50), gapFormula: z.literal("100 * (1 - source_score)"), combinedFormula: z.literal("available_weight_normalized_mean_then_missingness_penalty"), missingnessPenalty: z.literal("0.6 + 0.4 * coverage"), aipacAndDmfiLabelsNumericUse: z.literal(false), progressivePrimaryShareSubstitution: z.literal(false), ga2026DistrictRemap: z.literal("source_GA-07_Lucy_McBath_to_current_GA-06_identity_only") }),
  summary: z.strictObject({ seats: z.literal(212), leftScores: z.literal(212), palestineScores: z.literal(210), partialAlignmentScores: z.literal(2), exactDistrictJoins: z.literal(211), identityDistrictRemaps: z.literal(1), rowsWithAipacLabel: z.number().int().nonnegative(), rowsWithDmfiLabel: z.number().int().nonnegative(), scoreEligibleForProvisionalV02: z.literal(212) }),
  rowSetSha256: SHA,
  rows: z.array(z.strictObject({ seatCycleId: z.string(), stateCode: z.string().length(2), currentDistrictCode: z.string(), leftSourceDistrict: z.string(), palestineSourceDistrict: z.string(), firstName: z.string(), lastName: z.string(), leftScore: z.number().min(0).max(1), palestineScore: z.number().min(0).max(1).nullable(), palestineGrade: z.string().nullable(), endorsementLabels: z.string().nullable(), leftGap: z.number().min(0).max(100), palestineGap: z.number().min(0).max(100).nullable(), alignmentGap: z.number().min(0).max(100), coverage: z.union([z.literal(0.5), z.literal(1)]), inferredFromPartialCoverage: z.boolean(), joinMethod: z.enum(["exact_current_district", "identity_supported_historical_district_remap"]), rowSha256: SHA })).length(212),
  packageSha256: SHA,
});
export type IncumbentAlignmentTrackerCandidate = z.infer<typeof incumbentAlignmentTrackerCandidateSchema>;

export function buildIncumbentAlignmentTrackerCandidate(input: Readonly<{ leftBytes: Buffer; palestineBytes: Buffer; projection: Projection; projectionBytes: Buffer; sourceLock: Readonly<{ entries: readonly LockEntry[] }> }>, requireOutputLock = false): IncumbentAlignmentTrackerCandidate {
  validateLocks(input.sourceLock, requireOutputLock);
  if (sha(input.leftBytes) !== LEFT_HASH || input.leftBytes.length !== 1540131 || sha(input.palestineBytes) !== PALESTINE_HASH || input.palestineBytes.length !== 485731 || sha(input.projectionBytes) !== PROJECTION_HASH) fail("INPUT_HASH_INVALID");
  const left = workbookCells(input.leftBytes, "119th House"), palestine = workbookCells(input.palestineBytes, "119th House");
  if (left.get("B1") !== "First Name" || left.get("C1") !== "Last Name" || left.get("D1") !== "CD" || left.get("H1")?.replace(/\s+/g, " ").trim() !== "Total Left Score") fail("LEFT_HEADER_INVALID");
  if (palestine.get("C1") !== "First Name" || palestine.get("D1") !== "Last Name" || palestine.get("E1") !== "CD" || !palestine.get("H1")?.startsWith("Total Palestine Score")) fail("PALESTINE_HEADER_INVALID");
  const leftRows = Array.from({ length: 212 }, (_, index) => { const row = index + 4; return { district: district(left.get(`D${row}`) ?? ""), first: (left.get(`B${row}`) ?? "").trim(), last: (left.get(`C${row}`) ?? "").trim(), score: numeric(left.get(`H${row}`) ?? "")! }; });
  const palestineRows = Array.from({ length: 212 }, (_, index) => { const row = index + 5; return { district: district(palestine.get(`E${row}`) ?? ""), first: (palestine.get(`C${row}`) ?? "").trim(), last: (palestine.get(`D${row}`) ?? "").trim(), score: numeric(palestine.get(`H${row}`) ?? "", true), grade: (palestine.get(`A${row}`) ?? "").trim(), labels: (palestine.get(`I${row}`) ?? "").trim() }; });
  if (new Set(leftRows.map((row) => row.district)).size !== 212 || new Set(palestineRows.map((row) => row.district)).size !== 212) fail("SOURCE_DISTRICT_DUPLICATE");
  const leftByDistrict = new Map(leftRows.map((row) => [row.district, row])), palestineByCurrent = new Map(palestineRows.map((row) => [row.district === "GA-07" ? "GA-06" : row.district, row]));
  const projectionKeys = new Set(input.projection.seats.map((seat) => `${seat.stateCode}-${seat.districtCode}`));
  if (input.projection.seats.length !== 212 || projectionKeys.size !== 212 || leftByDistrict.size !== 212 || palestineByCurrent.size !== 212 || [...projectionKeys].some((key) => !leftByDistrict.has(key) || !palestineByCurrent.has(key))) fail("UNIVERSE_CLOSURE_INVALID");
  const rows = input.projection.seats.map((seat) => {
    const key = `${seat.stateCode}-${seat.districtCode}`, leftRow = leftByDistrict.get(key)!, palestineRow = palestineByCurrent.get(key)!;
    if (!leftRow.first || !leftRow.last || !palestineRow.first || !palestineRow.last || nameKey(leftRow.first, leftRow.last) !== nameKey(palestineRow.first, palestineRow.last)) fail(`NAME_JOIN_INVALID:${key}`);
    const coverage = palestineRow.score === null ? 0.5 as const : 1 as const, leftGap = round(100 * (1 - leftRow.score)), palestineGap = palestineRow.score === null ? null : round(100 * (1 - palestineRow.score));
    const rawGap = palestineGap === null ? leftGap : (leftGap + palestineGap) / 2, alignmentGap = round(rawGap * (0.6 + 0.4 * coverage));
    const unsigned = { seatCycleId: seat.seatCycleId, stateCode: seat.stateCode, currentDistrictCode: seat.districtCode, leftSourceDistrict: leftRow.district, palestineSourceDistrict: palestineRow.district, firstName: leftRow.first, lastName: leftRow.last, leftScore: leftRow.score, palestineScore: palestineRow.score, palestineGrade: palestineRow.grade === "N/A" ? null : palestineRow.grade, endorsementLabels: palestineRow.labels || null, leftGap, palestineGap, alignmentGap, coverage, inferredFromPartialCoverage: coverage < 1, joinMethod: (palestineRow.district === "GA-07" ? "identity_supported_historical_district_remap" : "exact_current_district") as "exact_current_district" | "identity_supported_historical_district_remap" };
    return { ...unsigned, rowSha256: hash("dsa-seats:incumbent-alignment-tracker-row:v1\0", unsigned) };
  }).sort((a, b) => order(a.seatCycleId, b.seatCycleId));
  const rowSetSha256 = hash("dsa-seats:incumbent-alignment-tracker-row-set:v1\0", rows);
  const unsigned = { schema: "incumbent-alignment-tracker-candidate-v1" as const, version: 1 as const, generatedAt: "2026-08-07T16:00:00.000Z" as const, sourceCutoff: "2026-08-04" as const, reviewerOnly: true as const, publicationEligible: false as const, assumption: { status: "owner_directed_assumed_correct_for_deadline" as const, scope: "provisional_score_calculation_only" as const, reviewerIdentityRecorded: false as const, approvalFabricated: false as const }, sources: [{ sourceLockId: LEFT_ID, driveFileId: "1gPBdBrqVCbtuy7f1bjOdCDUzEv5RqbbU1yYAr3KoHYE" as const, modifiedTime: "2026-08-04T19:39:13.817Z" as const, fileSha256: LEFT_HASH, sheet: "119th House" as const, scoreColumn: "Total Left Score" as const }, { sourceLockId: PALESTINE_ID, driveFileId: "1VU1y_jSb2hanU2MrLsjRx8tujB-C--UAQ2EahaTXGUo" as const, modifiedTime: "2026-07-30T17:48:22.629Z" as const, fileSha256: PALESTINE_HASH, sheet: "119th House" as const, scoreColumn: "Total Palestine Score" as const }] as const, methodology: { leftWeight: 50 as const, palestineWeight: 50 as const, gapFormula: "100 * (1 - source_score)" as const, combinedFormula: "available_weight_normalized_mean_then_missingness_penalty" as const, missingnessPenalty: "0.6 + 0.4 * coverage" as const, aipacAndDmfiLabelsNumericUse: false as const, progressivePrimaryShareSubstitution: false as const, ga2026DistrictRemap: "source_GA-07_Lucy_McBath_to_current_GA-06_identity_only" as const }, summary: { seats: 212 as const, leftScores: 212 as const, palestineScores: 210 as const, partialAlignmentScores: 2 as const, exactDistrictJoins: 211 as const, identityDistrictRemaps: 1 as const, rowsWithAipacLabel: rows.filter((row) => row.endorsementLabels?.split(/,\s*/).includes("AIPAC")).length, rowsWithDmfiLabel: rows.filter((row) => row.endorsementLabels?.split(/,\s*/).includes("DMFI")).length, scoreEligibleForProvisionalV02: 212 as const }, rowSetSha256, rows };
  return validateIncumbentAlignmentTrackerCandidate({ ...unsigned, packageSha256: hash("dsa-seats:incumbent-alignment-tracker-candidate:v1\0", unsigned) }, false);
}

export function validateIncumbentAlignmentTrackerCandidate(value: unknown, pin = true): IncumbentAlignmentTrackerCandidate {
  const parsed = incumbentAlignmentTrackerCandidateSchema.parse(value), { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:incumbent-alignment-tracker-candidate:v1\0", unsigned) || parsed.rowSetSha256 !== hash("dsa-seats:incumbent-alignment-tracker-row-set:v1\0", parsed.rows) || parsed.rows.some(({ rowSha256, ...row }) => rowSha256 !== hash("dsa-seats:incumbent-alignment-tracker-row:v1\0", row)) || (pin && (packageSha256 !== PACKAGE_HASH || parsed.rowSetSha256 !== ROW_SET_HASH))) fail("PACKAGE_INVALID");
  return parsed;
}

export const incumbentAlignmentTrackerPins = { outputHash: OUTPUT_HASH, outputBytes: OUTPUT_BYTES, packageHash: PACKAGE_HASH, rowSetHash: ROW_SET_HASH } as const;
