import { createHash } from "node:crypto";

import {
  RAPID_ACQUISITION_SCHEMA,
  type OfficeCatalogRecord,
  type RapidDataset,
  type RapidDatasetInput,
  type RapidSourceLockDocument,
  type ReportingUnitJoinContext,
  type ReportingUnitJoin,
} from "./contracts";

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const byteCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
};
const validText = (value: unknown) => typeof value === "string" && value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/.test(value) && !Number.isNaN(Date.parse(value));
const validFips = (value: unknown) => typeof value === "string" && /^\d{5}$/.test(value);
const validHash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validStringRecord = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 && Object.entries(value as Record<string, unknown>).every(([key, item]) => validText(key) && validText(item));
const oneOf = (value: unknown, values: readonly string[]) => values.includes(String(value));
const electionMethods = ["partisan_plurality", "nonpartisan_plurality", "ranked_choice", "top_two", "multi_member", "unknown"] as const;
const ids = (value: readonly string[], code: string) => {
  if (!value.length || value.some((id) => !validText(id)) || new Set(value).size !== value.length) throw new Error(code);
};
const distinct = <T>(values: readonly T[], key: (value: T) => string, code: string) => {
  const seen = new Set<string>();
  for (const value of values) { const valueKey = key(value); if (seen.has(valueKey)) throw new Error(code); seen.add(valueKey); }
};
const metricValue = (metric: string, value: unknown) => {
  if (!value || typeof value !== "object") throw new Error("RAPID_INVALID_METRIC_VALUE");
  const item = value as Record<string, unknown>;
  if (item.kind === "value" && typeof item.value === "number" && Number.isFinite(item.value)) {
    if (["renter_share", "age_18_34_share", "federal_democratic_share"].includes(metric) && item.value >= 0 && item.value <= 1) return;
    if (["active_registration", "ballots_cast", "cvap"].includes(metric) && Number.isSafeInteger(item.value) && item.value >= 0) return;
    if (["median_household_income", "population_density"].includes(metric) && item.value >= 0) return;
    throw new Error("RAPID_METRIC_VALUE_OUT_OF_RANGE");
  }
  if (item.kind === "missing" && ["not_collected", "not_reported", "authority_unavailable", "incompatible_reporting_unit", "not_applicable"].includes(String(item.reason))) return;
  throw new Error("RAPID_INVALID_METRIC_VALUE");
};
const scoreCompatible = (record: OfficeCatalogRecord) => record.electionMethod === "partisan_plurality" && record.districtMagnitude === 1;

const exactSet = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((value, index) => value === right[index]);
const sortedIds = (ids: readonly string[]) => [...ids].sort(byteCompare);
const evidenceIds = (join: ReportingUnitJoin): readonly string[] => join.kind === "at_large_statewide" ? join.countyUniverse.evidenceSourceLockIds : join.kind === "split_county_without_house_district" ? [] : join.evidenceSourceLockIds;

/** Returns a stable projection shape; callers persist this rather than source-order evidence arrays. */
export function canonicalizeReportingUnitJoin(join: ReportingUnitJoin): ReportingUnitJoin {
  if (join.kind === "at_large_statewide") return { ...join, countyUniverse: { ...join.countyUniverse, countyFips: sortedIds(join.countyUniverse.countyFips), evidenceSourceLockIds: sortedIds(join.countyUniverse.evidenceSourceLockIds) } };
  if (join.kind === "split_county_without_house_district") return join;
  return { ...join, evidenceSourceLockIds: sortedIds(join.evidenceSourceLockIds) };
}

export function reportingUnitJoinEligibility(join: ReportingUnitJoin, context: ReportingUnitJoinContext): Readonly<{ eligible: boolean; reason: "geography_vintage_mismatch" | "split_county_without_direct_assignment" | null }> {
  if (join.kind === "split_county_without_house_district") return { eligible: false, reason: "split_county_without_direct_assignment" };
  if (!validText(join.houseDistrict) || !validText(join.resultGeographyVintage) || !validText(join.houseGeographyVintage) || (join.kind === "county_wholly_in_house_district" && !validFips(join.countyFips)) || (join.kind === "reporting_unit_with_house_district" && !validText(join.reportingUnitKey))) return { eligible: false, reason: "split_county_without_direct_assignment" };
  if (join.resultGeographyVintage !== join.houseGeographyVintage) return { eligible: false, reason: "geography_vintage_mismatch" };
  const evidence = evidenceIds(join), lockIds = new Set(context.sourceLockIds);
  if (context.sourceLockIds.some((id) => !validText(id)) || new Set(context.sourceLockIds).size !== context.sourceLockIds.length) return { eligible: false, reason: "split_county_without_direct_assignment" };
  if (!evidence.length || evidence.some((id) => !validText(id) || !lockIds.has(id)) || new Set(evidence).size !== evidence.length) return { eligible: false, reason: "split_county_without_direct_assignment" };
  if (join.kind === "at_large_statewide") {
    const expected = context.expectedCountyFipsByState[join.stateCode];
    if (!/^[A-Z]{2}$/.test(join.stateCode) || join.houseDistrict !== `${join.stateCode}-AL` || !expected || !expected.countyFips.length || expected.countyFips.some((fips) => !validFips(fips)) || new Set(expected.countyFips).size !== expected.countyFips.length || !expected.evidenceSourceLockIds.length || expected.evidenceSourceLockIds.some((id) => !validText(id) || !lockIds.has(id)) || new Set(expected.evidenceSourceLockIds).size !== expected.evidenceSourceLockIds.length || join.countyUniverse.status !== "closed" || !join.countyUniverse.countyFips.length || join.countyUniverse.countyFips.some((fips) => !validFips(fips)) || new Set(join.countyUniverse.countyFips).size !== join.countyUniverse.countyFips.length || !exactSet(sortedIds(join.countyUniverse.countyFips), sortedIds(expected.countyFips))) return { eligible: false, reason: "split_county_without_direct_assignment" };
  }
  return { eligible: true, reason: null };
}

function parseSourceLock(bytes: Uint8Array): RapidSourceLockDocument {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new Error("RAPID_INVALID_SOURCE_LOCK"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("RAPID_INVALID_SOURCE_LOCK");
  const document = value as { version?: unknown; entries?: unknown };
  if (document.version !== 1 || !Array.isArray(document.entries) || document.entries.some((entry) => !entry || typeof entry !== "object" || !validText((entry as { id?: unknown }).id)) || new Set(document.entries.map((entry) => (entry as { id: string }).id)).size !== document.entries.length) throw new Error("RAPID_INVALID_SOURCE_LOCK");
  return { version: 1, entries: document.entries.map((entry) => ({ id: (entry as { id: string }).id })) };
}

function validate(input: RapidDatasetInput, sourceLockBytes: Uint8Array): void {
  if (input.schema !== RAPID_ACQUISITION_SCHEMA || input.version !== 1 || !validHash(input.sourceLockSha256) || sha256(sourceLockBytes) !== input.sourceLockSha256) throw new Error("RAPID_SOURCE_LOCK_MISMATCH");
  const lock = parseSourceLock(sourceLockBytes);
  distinct(input.sources, (source) => source.lockId, "RAPID_DUPLICATE_SOURCE");
  for (const source of input.sources) if (!validText(source.lockId) || !["official_direct", "official_derived", "research_fallback"].includes(source.authority) || !validText(source.parserVersion) || !validDate(source.retrievedAt)) throw new Error("RAPID_INVALID_SOURCE");
  const lockIds = new Set(lock.entries.map((entry) => entry.id));
  if (input.sources.some((source) => !lockIds.has(source.lockId))) throw new Error("RAPID_UNKNOWN_SOURCE_LOCK_ID");
  const sourceIds = new Set(input.sources.map((source) => source.lockId));
  const sourceBound = (value: unknown) => { if (!Array.isArray(value)) throw new Error("RAPID_INVALID_SOURCE_BINDING"); ids(value, "RAPID_INVALID_SOURCE_BINDING"); if (value.some((id) => !sourceIds.has(id))) throw new Error("RAPID_UNKNOWN_SOURCE"); };
  distinct(input.jurisdictions, (row) => row.id, "RAPID_DUPLICATE_JURISDICTION");
  for (const row of input.jurisdictions) {
    if (!validText(row.id) || !/^[A-Z]{2}$/.test(row.stateCode) || !["county", "state_leg_district", "house_district"].includes(row.level) || !validStringRecord(row.sourceIdentifiers)) throw new Error("RAPID_INVALID_JURISDICTION");
    if (row.level === "county" && !validFips(row.countyFips)) throw new Error("RAPID_INVALID_COUNTY_FIPS");
    if (row.countyFips !== undefined && !validFips(row.countyFips)) throw new Error("RAPID_INVALID_COUNTY_FIPS");
  }
  const jurisdictionIds = new Set(input.jurisdictions.map((row) => row.id));
  distinct(input.contests, (row) => row.id, "RAPID_DUPLICATE_CONTEST");
  distinct(input.contests, (row) => `${row.authoritativeSourceLockId}\0${row.sourceNaturalKey}`, "RAPID_DUPLICATE_SOURCE_CONTEST");
  for (const row of input.contests) {
    if (!validText(row.id) || !validText(row.sourceNaturalKey) || !validText(row.authoritativeSourceLockId) || !jurisdictionIds.has(row.jurisdictionId) || !validDate(row.electionDate) || !validText(row.electionGeographyVintage) || !validText(row.sourceOfficeTitle) || !validText(row.normalizedOfficeTitle) || !oneOf(row.electionType, ["primary", "general", "runoff", "special", "other"]) || !oneOf(row.governmentLevel, ["federal", "state", "county", "municipal", "special_district"]) || !oneOf(row.officeFamily, ["legislature", "executive", "commission", "prosecutor", "sheriff", "judicial", "other"]) || !oneOf(row.electionMethod, electionMethods) || !oneOf(row.resultStatus, ["certified", "official_reported", "unofficial", "not_collected"]) || !Number.isSafeInteger(row.districtMagnitude) || row.districtMagnitude < 1) throw new Error("RAPID_INVALID_CONTEST");
    sourceBound(row.sourceLockIds);
    if (!row.sourceLockIds.includes(row.authoritativeSourceLockId)) throw new Error("RAPID_INVALID_CONTEST_SOURCE");
  }
  const contestIds = new Set(input.contests.map((row) => row.id));
  distinct(input.candidateResults, (row) => `${row.contestId}\0${row.sourceCandidateKey}`, "RAPID_DUPLICATE_CANDIDATE_RESULT");
  for (const row of input.candidateResults) {
    if (!contestIds.has(row.contestId) || !validText(row.sourceCandidateKey) || !validText(row.sourceCandidateName) || (row.party !== null && !validText(row.party)) || !oneOf(row.winnerStatus, ["source_marked_winner", "not_marked_by_source", "not_applicable"])) throw new Error("RAPID_INVALID_CANDIDATE_RESULT");
    if (!Number.isSafeInteger(row.votes) || row.votes < 0) throw new Error("RAPID_INVALID_VOTES");
    sourceBound(row.sourceLockIds);
  }
  if (input.candidateResults.some((row) => input.contests.find((contest) => contest.id === row.contestId)?.resultStatus === "not_collected")) throw new Error("RAPID_NOT_COLLECTED_CONTEST_HAS_CANDIDATES");
  distinct(input.countyMetrics, (row) => `${row.countyFips}\0${row.metric}\0${row.periodStart}\0${row.periodEnd}`, "RAPID_DUPLICATE_COUNTY_METRIC");
  for (const row of input.countyMetrics) { if (!validFips(row.countyFips) || !validDate(row.periodStart) || !validDate(row.periodEnd) || row.periodStart > row.periodEnd || !oneOf(row.metric, ["active_registration", "ballots_cast", "cvap", "renter_share", "age_18_34_share", "median_household_income", "population_density", "federal_democratic_share"]) || !oneOf(row.reportingUnitDefinition, ["county-equivalent", "other_administrative_unit"])) throw new Error("RAPID_INVALID_COUNTY_METRIC"); metricValue(row.metric, row.value); sourceBound(row.sourceLockIds); }
  distinct(input.officeCatalog, (row) => row.id, "RAPID_DUPLICATE_OFFICE");
  for (const row of input.officeCatalog) {
    if (!validText(row.id) || !jurisdictionIds.has(row.jurisdictionId) || !validText(row.sourceOfficeTitle) || !validText(row.normalizedOfficeTitle) || !oneOf(row.governmentLevel, ["federal", "state", "county", "municipal", "special_district"]) || !oneOf(row.officeFamily, ["legislature", "executive", "commission", "prosecutor", "sheriff", "judicial", "other"]) || !oneOf(row.electionMethod, electionMethods) || !oneOf(row.currentStatus, ["occupied", "open", "unknown"]) || !oneOf(row.currentStatusConfidence, ["official_direct", "official_derived", "research_fallback"]) || !oneOf(row.formulaEligibility, ["eligible", "catalog_only", "formula_ineligible"]) || !Number.isSafeInteger(row.districtMagnitude) || row.districtMagnitude < 1) throw new Error("RAPID_INVALID_OFFICE");
    if (!Array.isArray(row.currentStatusSourceLockIds)) throw new Error("RAPID_CURRENT_STATUS_SOURCE_REQUIRED");
    if ((row.currentStatus === "occupied" || row.currentStatus === "open") && !row.currentStatusSourceLockIds.length) throw new Error("RAPID_CURRENT_STATUS_SOURCE_REQUIRED");
    if (row.currentStatus === "unknown" && row.formulaEligibility === "eligible") throw new Error("RAPID_FORMULA_ELIGIBILITY_INVALID");
    if (row.formulaEligibility === "eligible" && (!scoreCompatible(row) || row.currentStatusConfidence !== "official_direct" || !row.currentStatusSourceLockIds.some((id) => input.sources.find((source) => source.lockId === id)?.authority === "official_direct"))) throw new Error("RAPID_FORMULA_ELIGIBILITY_INVALID");
    sourceBound(row.sourceLockIds);
    if (row.currentStatusSourceLockIds.length) sourceBound(row.currentStatusSourceLockIds);
  }
}

const sorted = (input: RapidDatasetInput) => ({
  ...input,
  sources: [...input.sources].sort((a, b) => byteCompare(a.lockId, b.lockId)),
  jurisdictions: [...input.jurisdictions].sort((a, b) => byteCompare(a.id, b.id)),
  contests: [...input.contests].map((row) => ({ ...row, sourceLockIds: [...row.sourceLockIds].sort(byteCompare) })).sort((a, b) => byteCompare(a.id, b.id)),
  candidateResults: [...input.candidateResults].map((row) => ({ ...row, sourceLockIds: [...row.sourceLockIds].sort(byteCompare) })).sort((a, b) => byteCompare(`${a.contestId}\0${a.sourceCandidateKey}`, `${b.contestId}\0${b.sourceCandidateKey}`)),
  countyMetrics: [...input.countyMetrics].map((row) => ({ ...row, sourceLockIds: [...row.sourceLockIds].sort(byteCompare) })).sort((a, b) => byteCompare(`${a.countyFips}\0${a.metric}\0${a.periodStart}\0${a.periodEnd}`, `${b.countyFips}\0${b.metric}\0${b.periodStart}\0${b.periodEnd}`)),
  officeCatalog: [...input.officeCatalog].map((row) => ({ ...row, sourceLockIds: [...row.sourceLockIds].sort(byteCompare), currentStatusSourceLockIds: [...row.currentStatusSourceLockIds].sort(byteCompare) })).sort((a, b) => byteCompare(a.id, b.id)),
});

export function canonicalRapidHash(dataset: Omit<RapidDataset, "datasetSha256"> | RapidDataset): string {
  const unsigned = { ...dataset } as Record<string, unknown>; delete unsigned.datasetSha256;
  return sha256(`dsa-seats:rapid-acquisition:v1\0${canonical(unsigned)}`);
}

export function normalizeRapidDataset(input: RapidDatasetInput, sourceLockBytes: Uint8Array): RapidDataset {
  validate(input, sourceLockBytes);
  const normalized = sorted(input);
  const counts = { jurisdictions: normalized.jurisdictions.length, contests: normalized.contests.length, candidateResults: normalized.candidateResults.length, countyMetrics: normalized.countyMetrics.length, officeCatalog: normalized.officeCatalog.length };
  const unsigned = { ...normalized, counts };
  return { ...unsigned, datasetSha256: canonicalRapidHash(unsigned) };
}
