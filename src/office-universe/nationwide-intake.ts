import { createHash } from "node:crypto";

export const STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
export type StateCode = (typeof STATE_CODES)[number];
export type SourceFamily = "discovery" | "elections" | "finance" | "geography" | "officeholders";
export type SourceRegistryStatus = "configured" | "authority_unavailable" | "contract_pending";
export type IntakeDisposition = "accepted" | "quarantined";
export type FactMaturity = "raw" | "normalized" | "reported_result" | "provisional_winner" | "certified_winner" | "superseded";

export type SourceRegistryEntry = Readonly<{
  stateCode: StateCode;
  family: SourceFamily;
  sourceKey: string;
  authorityTier: "national_discovery" | "official" | "aggregator";
  status: SourceRegistryStatus;
  sourceUrl: string | null;
  refreshProfile: "weekly" | "nightly" | "daily" | "election_window";
}>;

/** Every state has the same durable source-family slots. Unconfigured slots are
 * explicit work, not absent data or a claim that the authority does not exist. */
export function buildNationwideSourceRegistry(): readonly SourceRegistryEntry[] {
  return STATE_CODES.flatMap((stateCode) => [
    { stateCode, family: "discovery", sourceKey: `us-census-government-units:${stateCode}`, authorityTier: "national_discovery", status: "configured", sourceUrl: "https://www.census.gov/programs-surveys/gus.html", refreshProfile: "weekly" },
    { stateCode, family: "geography", sourceKey: `us-census-geography:${stateCode}`, authorityTier: "national_discovery", status: "configured", sourceUrl: "https://www.census.gov/geographies/mapping-files.html", refreshProfile: "weekly" },
    { stateCode, family: "elections", sourceKey: `state-election-authority:${stateCode}`, authorityTier: "official", status: "authority_unavailable", sourceUrl: null, refreshProfile: "election_window" },
    { stateCode, family: "finance", sourceKey: `state-finance-authority:${stateCode}`, authorityTier: "official", status: "authority_unavailable", sourceUrl: null, refreshProfile: "nightly" },
    { stateCode, family: "officeholders", sourceKey: `state-officeholder-authority:${stateCode}`, authorityTier: "official", status: "authority_unavailable", sourceUrl: null, refreshProfile: "daily" },
  ] as const);
}

export type RawIntakeRecord = Readonly<{
  sourceKey: string;
  snapshotId: string;
  payloadSha256: string;
  payloadLocator: string;
  sourceNaturalKey: string | null;
  kind: "jurisdiction" | "body" | "office" | "term" | "holder" | "contest" | "result" | "filing" | "calendar" | "finance" | "geography";
  observedAt: string;
  payload: unknown;
}>;
export type IntakeIssue = Readonly<{ code: string; diagnostic: string }>;
export type IntakeDecision = Readonly<{ disposition: IntakeDisposition; issues: readonly IntakeIssue[] }>;

const SHA = /^[a-f0-9]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const forbidden = /(?:\baddress\b|\bcontributor\b|\bsocial security\b)/i;
const naturalKey = (value: string | null) => value === null || value.trim().length > 0;

/**
 * This is intentionally a quarantine-only gate. It protects raw retention and
 * graph integrity without requiring complete coverage, certification, or a
 * formula before data can enter the statewide/local intake lane.
 */
export function assessRawIntake(record: RawIntakeRecord): IntakeDecision {
  const issues: IntakeIssue[] = [];
  if (!record.sourceKey || !record.snapshotId || !record.payloadLocator || !SHA.test(record.payloadSha256))
    issues.push({ code: "SOURCE_REFERENCE_INVALID", diagnostic: "source snapshot or immutable payload receipt is invalid" });
  if (record.payloadLocator.startsWith("/") || record.payloadLocator.includes("\\") || record.payloadLocator.split("/").includes(".."))
    issues.push({ code: "PAYLOAD_LOCATOR_INVALID", diagnostic: "payload locator escapes the raw store" });
  if (!naturalKey(record.sourceNaturalKey)) issues.push({ code: "NATURAL_KEY_INVALID", diagnostic: "source natural key is blank" });
  if (!ISO.test(record.observedAt) || Number.isNaN(Date.parse(record.observedAt)))
    issues.push({ code: "OBSERVATION_TIME_INVALID", diagnostic: "observedAt is not an ISO UTC timestamp" });
  if (record.payload === null || typeof record.payload !== "object")
    issues.push({ code: "PAYLOAD_INVALID", diagnostic: "payload must be an object or array" });
  if (forbidden.test(JSON.stringify(record.payload)))
    issues.push({ code: "PROHIBITED_PERSONAL_DATA", diagnostic: "payload requires scoped privacy review" });
  return { disposition: issues.length ? "quarantined" : "accepted", issues };
}

export type ResultObservation = Readonly<{
  contestId: string;
  sourceNaturalKey: string;
  observedAt: string;
  maturity: FactMaturity;
  winnerCandidateKey: string | null;
  reportingCompletenessPercent: number | null;
  sourceSnapshotId: string;
}>;
export type HolderTransition = Readonly<{
  officeId: string;
  holderId: string | null;
  status: "holder_pending_transition" | "current_holder" | "vacant" | "unknown";
  effectiveAt: string;
  sourceSnapshotId: string;
}>;

/** A reported primary/general winner is not the current officeholder until its term is effective. */
export function holderTransitionFromResult(
  result: ResultObservation,
  officeId: string,
  termStartsAt: string | null,
): HolderTransition | null {
  if (!result.winnerCandidateKey || !termStartsAt) return null;
  return {
    officeId,
    holderId: result.winnerCandidateKey,
    status: "holder_pending_transition",
    effectiveAt: termStartsAt,
    sourceSnapshotId: result.sourceSnapshotId,
  };
}

export type CalculationInput = Readonly<{
  officeId: string;
  factKey: string;
  maturity: FactMaturity;
  value: number | string | boolean | null;
  missingReason: string | null;
  sourceSnapshotId: string;
}>;
export type CalculationWorkspace = "provisional" | "certified";

export function selectCalculationInputs(
  workspace: CalculationWorkspace,
  inputs: readonly CalculationInput[],
): readonly CalculationInput[] {
  const allowed = workspace === "provisional"
    ? new Set<FactMaturity>(["reported_result", "provisional_winner", "certified_winner"])
    : new Set<FactMaturity>(["certified_winner"]);
  return inputs.filter((input) => allowed.has(input.maturity) && input.value !== null && input.missingReason === null);
}

export function intakeFingerprint(record: RawIntakeRecord): string {
  return createHash("sha256")
    .update(JSON.stringify({ sourceKey: record.sourceKey, snapshotId: record.snapshotId, payloadSha256: record.payloadSha256, sourceNaturalKey: record.sourceNaturalKey, kind: record.kind }))
    .digest("hex");
}
