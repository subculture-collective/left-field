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
export type RawIntakeKind = RawIntakeRecord["kind"];
export const RAW_INTAKE_KINDS: readonly RawIntakeKind[] = ["jurisdiction", "body", "office", "term", "holder", "contest", "result", "filing", "calendar", "finance", "geography"];

/** A reviewed, scoped source definition. Only `reviewed` definitions may back a snapshot. */
export type SourceDefinitionStatus = "draft" | "reviewed" | "rejected" | "retired";
export type SourceDefinition = Readonly<{
  id: string;
  stateCode: StateCode;
  family: SourceFamily;
  sourceKey: string;
  authorityTier: "official" | "aggregator";
  authorityScope: readonly [string, ...string[]];
  precedence: number;
  sourceUrl: string;
  retentionBasis: string;
  allowedKinds: readonly [RawIntakeKind, ...RawIntakeKind[]];
  privacyPolicy: "public_office_only" | "finance_allowlist";
  status: SourceDefinitionStatus;
}>;

/** Receipt for bytes retained outside Postgres. `verified` is only set by the
 * read-only retained-object verifier; an unverified receipt cannot back a snapshot. */
export type RetainedObjectReceipt = Readonly<{
  sourceId: string;
  locator: string;
  byteSize: number;
  sha256: string;
  retrievedAt: string;
  finalUrl: string;
  parserVersion: string;
  verified: boolean;
}>;

/** Systemic faults quarantine the whole snapshot; isolated row faults quarantine only their rows. */
export type SnapshotDisposition = "accepted" | "accepted_with_row_quarantine" | "quarantined";

export const SHA256_HEX = /^[a-f0-9]{64}$/;
export const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SHA = SHA256_HEX;
const ISO = ISO_UTC;
export const isIsoUtc = (value: string): boolean => ISO_UTC.test(value) && !Number.isNaN(Date.parse(value));
export const isUnsafeLocator = (locator: string): boolean =>
  locator.length === 0 || locator.startsWith("/") || locator.includes("\\") || locator.split("/").includes("..");
export type PrivacyPolicy = SourceDefinition["privacyPolicy"];
export type RawIntakeOptions = Readonly<{ privacyPolicy?: PrivacyPolicy }>;

/** Reviewed payload keys for `public_office_only` sources. Every key at every
 * depth must be listed; anything else quarantines the row. Extending this set
 * is a privacy review, not a parser convenience. */
export const PUBLIC_OFFICE_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "office", "district", "chamber", "body", "jurisdiction", "seat", "level", "state",
  "name", "party", "candidate", "candidates", "incumbent", "winner",
  "term", "term_start", "term_end", "cycle", "election", "election_date", "contest", "contests",
  "source", "url", "observed_at", "status", "id", "key", "title",
  "votes", "total_votes", "percent", "results", "result", "precincts_reporting", "precincts_total",
]);

/** No source-specific reviewed finance allowlist exists yet, so every
 * `finance_allowlist` payload is rejected with this stable code. */
export const FINANCE_ALLOWLIST_PENDING = "FINANCE_ALLOWLIST_PENDING";

/** Walks nested objects and arrays and returns the dotted paths of keys outside `allowed`. */
export function disallowedKeyPaths(payload: unknown, allowed: ReadonlySet<string>): readonly string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${path}[${index}]`)); return; }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key;
      if (!allowed.has(key)) found.push(next);
      walk(child, next);
    }
  };
  walk(payload, "");
  return found;
}

export function assessPayloadPrivacy(payload: unknown, privacyPolicy: PrivacyPolicy): readonly IntakeIssue[] {
  if (privacyPolicy === "finance_allowlist")
    return [{ code: FINANCE_ALLOWLIST_PENDING, diagnostic: "finance payloads are rejected until a source-specific reviewed allowlist exists" }];
  return disallowedKeyPaths(payload, PUBLIC_OFFICE_PAYLOAD_KEYS).map((path) => ({ code: "PROHIBITED_PERSONAL_DATA", diagnostic: `payload key "${path}" is not in the reviewed public_office_only allowlist` }));
}
const naturalKey = (value: string | null) => value === null || value.trim().length > 0;

/**
 * This is intentionally a quarantine-only gate. It protects raw retention and
 * graph integrity without requiring complete coverage, certification, or a
 * formula before data can enter the statewide/local intake lane. Privacy is
 * enforced by reviewed key allowlists, not keyword scanning: the policy comes
 * from the source definition, defaulting to `finance_allowlist` for finance
 * rows and `public_office_only` otherwise.
 */
export function assessRawIntake(record: RawIntakeRecord, options: RawIntakeOptions = {}): IntakeDecision {
  const privacyPolicy = options.privacyPolicy ?? (record.kind === "finance" ? "finance_allowlist" : "public_office_only");
  const issues: IntakeIssue[] = [];
  if (!record.sourceKey || !record.snapshotId || !record.payloadLocator || !SHA.test(record.payloadSha256))
    issues.push({ code: "SOURCE_REFERENCE_INVALID", diagnostic: "source snapshot or immutable payload receipt is invalid" });
  if (isUnsafeLocator(record.payloadLocator))
    issues.push({ code: "PAYLOAD_LOCATOR_INVALID", diagnostic: "payload locator escapes the raw store" });
  if (!naturalKey(record.sourceNaturalKey)) issues.push({ code: "NATURAL_KEY_INVALID", diagnostic: "source natural key is blank" });
  if (!ISO.test(record.observedAt) || Number.isNaN(Date.parse(record.observedAt)))
    issues.push({ code: "OBSERVATION_TIME_INVALID", diagnostic: "observedAt is not an ISO UTC timestamp" });
  if (record.payload === null || typeof record.payload !== "object")
    issues.push({ code: "PAYLOAD_INVALID", diagnostic: "payload must be an object or array" });
  else issues.push(...assessPayloadPrivacy(record.payload, privacyPolicy));
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

/**
 * A reported or provisional winner is never projected onto an office. Only a
 * certified winner with a sourced ISO UTC term-effective time yields a
 * transition, and that transition is always `holder_pending_transition`;
 * promotion to `current_holder` is a separate, later decision.
 */
export function holderTransitionFromResult(
  result: ResultObservation,
  officeId: string,
  termStartsAt: string | null,
): HolderTransition | null {
  if (result.maturity !== "certified_winner" || !result.winnerCandidateKey || !result.sourceSnapshotId) return null;
  if (termStartsAt === null || !isIsoUtc(termStartsAt)) return null;
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
