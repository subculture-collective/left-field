import { createHash } from "node:crypto";

export const ELECTION_DECISION_SNAPSHOT_V1 = 1 as const;
export const PRESIDENTIAL_JURISDICTIONS = Object.freeze(["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"] as const);
export const NATIONWIDE_JURISDICTIONS = Object.freeze([...PRESIDENTIAL_JURISDICTIONS, "AS", "GU", "MP", "PR", "VI"] as const);
/** @deprecated Use the year-specific jurisdiction constants. */
export const TASK9_JURISDICTIONS = PRESIDENTIAL_JURISDICTIONS;
const gateNames = ["sourceAuthority", "license", "certification", "reportingUnitGeometry", "nonGeographicPolicy", "allocation", "reconciliation", "rounding", "coverage"] as const;
export const MAX_ELECTION_DECISION_SNAPSHOT_BYTES = 64 * 1024;
const MAX_ROOT_EVIDENCE_IDS = 64;
const MAX_GATE_EVIDENCE_IDS = 16;
export type ElectionGateName = typeof gateNames[number];
export type GateOutcome = "unassessed" | "passed" | "failed";
export type FailureReason = "landing_only_evidence" | "license_unavailable" | "source_not_authoritative" | "certification_missing" | "geometry_unavailable" | "policy_missing" | "allocation_invalid" | "reconciliation_mismatch" | "rounding_unspecified" | "coverage_incomplete";
type GateValue = Readonly<Record<string, unknown>>;
export type ElectionGate = Readonly<{ outcome: GateOutcome; evidenceSnapshotIds: readonly string[]; value: GateValue | null; failureReason: FailureReason | null }>;
export type ElectionDecisionSnapshotV1 = Readonly<{ schemaVersion: 1; jurisdictionCode: typeof NATIONWIDE_JURISDICTIONS[number]; electionYear: 2020 | 2022 | 2024; reviewDate: string; methodology: string; evidenceSnapshotIds: readonly string[]; gates: Readonly<Record<ElectionGateName, ElectionGate>> }>;
export type ElectionDecisionStatus = "unassessed" | "unavailable" | "approved";
export class ElectionDecisionError extends Error { constructor(readonly code: string) { super(`Election decision rejected: ${code}`); this.name = "ElectionDecisionError"; } }
const fail = (code: string): never => { throw new ElectionDecisionError(code); };
const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v;
const text = (v: unknown, max = 256): v is string => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const snapshotId = (v: unknown): v is string => typeof v === "string" && /^snap_[A-Za-z0-9:_-]{1,123}$/.test(v);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 1_000_000_000;
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : fail("OBJECT_REQUIRED");
const exact = (v: Record<string, unknown>, keys: readonly string[]) => { if (Object.keys(v).length !== keys.length || Object.keys(v).some(k => !keys.includes(k))) fail("UNKNOWN_OR_MISSING_KEY"); };
const byte = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const canonicalArray = (v: unknown, predicate: (x: unknown) => boolean, max = MAX_ROOT_EVIDENCE_IDS) => Array.isArray(v) && v.length <= max && v.every(predicate) && v.every((x, i, a) => i === 0 || byte(String(a[i - 1]), String(x)) < 0);
const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted).sort((a, b) => byte(JSON.stringify(a), JSON.stringify(b))) : v !== null && typeof v === "object" ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort(byte).map(k => [k, sorted((v as Record<string, unknown>)[k])])) : v;
const valueKeys: Record<ElectionGateName, readonly string[]> = {
  sourceAuthority: ["originalPublisher","intermediaries"], license: ["assessment"], certification: ["value","scope"], reportingUnitGeometry: ["release","vintage"], nonGeographicPolicy: ["policy"], allocation: ["method","crosswalkMethodology","weightsMethodology"], reconciliation: ["delta","authorityTotal"], rounding: ["rule"], coverage: ["expectedCount","actualCount"],
};
function validValue(name: ElectionGateName, raw: unknown): raw is GateValue {
  const v = object(raw); exact(v, valueKeys[name]);
  if (name === "sourceAuthority") return Array.isArray(v.intermediaries) && v.intermediaries.length <= 16 && v.intermediaries.every((x, i, xs) => { const y = object(x); exact(y, ["identity","role","evidenceKind"]); return (!i || JSON.stringify(sorted(xs[i - 1])) < JSON.stringify(sorted(x))) && text(y.identity) && ["intermediary","distributor"].includes(String(y.role)) && ["record","landing_only"].includes(String(y.evidenceKind)); }) && (() => { const p = object(v.originalPublisher); exact(p, ["identity","role","evidenceKind"]); return text(p.identity) && p.role === "original_publisher" && ["record","landing_only"].includes(String(p.evidenceKind)); })();
  if (name === "license") return ["approved","restricted","unknown"].includes(String(v.assessment));
  if (name === "certification") return text(v.value) && text(v.scope);
  if (name === "reportingUnitGeometry") return text(v.release) && text(v.vintage);
  if (name === "nonGeographicPolicy") return text(v.policy);
  if (name === "allocation") return ["none","precinct_overlay","population_crosswalk","other"].includes(String(v.method)) && text(v.crosswalkMethodology) && text(v.weightsMethodology);
  if (name === "reconciliation") return integer(v.delta) && integer(v.authorityTotal);
  if (name === "rounding") return text(v.rule);
  return integer(v.expectedCount) && integer(v.actualCount) && (v.actualCount as number) <= (v.expectedCount as number);
}
function coherentGate(name: ElectionGateName, outcome: GateOutcome, value: GateValue, reason: FailureReason | null): boolean {
  const v = value as Record<string, unknown>;
  if (outcome === "passed") {
    if (reason !== null) return false;
    if (name === "sourceAuthority") return (v.originalPublisher as Record<string, unknown>).evidenceKind === "record";
    if (name === "license") return v.assessment === "approved";
    if (name === "certification") return v.value === "certified";
    if (name === "reconciliation") return v.delta === 0;
    if (name === "coverage") return v.actualCount === v.expectedCount;
    if (name === "nonGeographicPolicy") return v.policy !== "missing";
    if (name === "rounding") return v.rule !== "unspecified";
    if (name === "reportingUnitGeometry") return v.release !== "unavailable" && v.vintage !== "unavailable";
    return name !== "allocation" || v.method !== "other";
  }
  const required: Record<ElectionGateName, FailureReason> = { sourceAuthority: "source_not_authoritative", license: "license_unavailable", certification: "certification_missing", reportingUnitGeometry: "geometry_unavailable", nonGeographicPolicy: "policy_missing", allocation: "allocation_invalid", reconciliation: "reconciliation_mismatch", rounding: "rounding_unspecified", coverage: "coverage_incomplete" };
  if (reason !== required[name] && !(name === "sourceAuthority" && reason === "landing_only_evidence")) return false;
  if (name === "sourceAuthority") return reason === "landing_only_evidence" ? (v.originalPublisher as Record<string, unknown>).evidenceKind === "landing_only" : (v.originalPublisher as Record<string, unknown>).evidenceKind === "record";
  if (name === "license") return v.assessment === "restricted" || v.assessment === "unknown";
  if (name === "certification") return v.value !== "certified";
  if (name === "reconciliation") return (v.delta as number) > 0;
  if (name === "coverage") return (v.actualCount as number) < (v.expectedCount as number);
  if (name === "nonGeographicPolicy") return v.policy === "missing";
  if (name === "rounding") return v.rule === "unspecified";
  if (name === "reportingUnitGeometry") return v.release === "unavailable" || v.vintage === "unavailable";
  return v.method === "other";
}
export function deriveElectionDecisionStatus(gates: Readonly<Record<ElectionGateName, ElectionGate>>): ElectionDecisionStatus { const first = gateNames.map(name => gates[name].outcome).find(outcome => outcome !== "passed"); return first === undefined ? "approved" : first === "unassessed" ? "unassessed" : "unavailable"; }
export function parseElectionDecisionSnapshotV1(value: unknown): ElectionDecisionSnapshotV1 {
  const root = object(value); exact(root, ["schemaVersion","jurisdictionCode","electionYear","reviewDate","methodology","evidenceSnapshotIds","gates"]);
  const isPermittedJurisdiction = root.electionYear === 2022 ? NATIONWIDE_JURISDICTIONS.includes(root.jurisdictionCode as never) : PRESIDENTIAL_JURISDICTIONS.includes(root.jurisdictionCode as never);
  if (root.schemaVersion !== 1 || !isPermittedJurisdiction || (root.electionYear !== 2020 && root.electionYear !== 2022 && root.electionYear !== 2024) || !date(root.reviewDate) || !text(root.methodology) || !canonicalArray(root.evidenceSnapshotIds, snapshotId)) fail("INVALID_DECISION_HEADER");
  const evidence = root.evidenceSnapshotIds as string[]; const rawGates = object(root.gates); exact(rawGates, gateNames); const gates = {} as Record<ElectionGateName, ElectionGate>; const closure = new Set<string>();
  for (let i = 0; i < gateNames.length; i += 1) { const name = gateNames[i]!; const raw = object(rawGates[name]); exact(raw, ["outcome","evidenceSnapshotIds","value","failureReason"]); const outcome = raw.outcome; if (!(outcome === "unassessed" || outcome === "passed" || outcome === "failed") || !canonicalArray(raw.evidenceSnapshotIds, snapshotId, MAX_GATE_EVIDENCE_IDS)) fail("INVALID_GATE"); const ids = raw.evidenceSnapshotIds as string[];
    if (outcome === "unassessed" && (ids.length || raw.value !== null || raw.failureReason !== null)) fail("UNASSESSED_HAS_VALUE_OR_EVIDENCE");
    if (name === "sourceAuthority" && outcome === "passed" && raw.value !== null && validValue(name, raw.value) && (object(raw.value).originalPublisher as Record<string, unknown>).evidenceKind === "landing_only") fail("LANDING_EVIDENCE_CANNOT_PASS");
    if (outcome !== "unassessed" && (!ids.length || raw.value === null || !validValue(name, raw.value) || !(typeof raw.failureReason === "string" || raw.failureReason === null) || !coherentGate(name, outcome as GateOutcome, raw.value as GateValue, raw.failureReason as FailureReason | null))) fail("GATE_VALUE_OR_EVIDENCE_REQUIRED");
    if (ids.some(x => !evidence.includes(x))) fail("GATE_EVIDENCE_NOT_BOUND"); ids.forEach(x => closure.add(x));
    gates[name] = { outcome: outcome as GateOutcome, evidenceSnapshotIds: ids, value: raw.value as GateValue | null, failureReason: raw.failureReason as FailureReason | null };
  }
  const firstNonPassed = gateNames.findIndex(name => gates[name]!.outcome !== "passed");
  if (firstNonPassed !== -1) {
    const firstOutcome = gates[gateNames[firstNonPassed]!]!.outcome;
    const later = gateNames.slice(firstNonPassed + 1).map(name => gates[name]!.outcome);
    if ((firstOutcome === "unassessed" && later.some(outcome => outcome !== "unassessed")) || (firstOutcome === "failed" && later.includes("passed"))) fail("GATE_DEPENDENCY_VIOLATION");
  }
  if (closure.size !== evidence.length || evidence.some(x => !closure.has(x))) fail("ORPHAN_EVIDENCE");
  return { schemaVersion: 1, jurisdictionCode: root.jurisdictionCode as ElectionDecisionSnapshotV1["jurisdictionCode"], electionYear: root.electionYear as 2020 | 2022 | 2024, reviewDate: root.reviewDate as string, methodology: root.methodology as string, evidenceSnapshotIds: evidence, gates };
}
export function encodeElectionDecisionSnapshotV1(value: unknown): Uint8Array { return Buffer.from(JSON.stringify(sorted(parseElectionDecisionSnapshotV1(value))), "utf8"); }
export function decodeElectionDecisionSnapshotV1(bytes: Uint8Array): ElectionDecisionSnapshotV1 { if (bytes.byteLength > MAX_ELECTION_DECISION_SNAPSHOT_BYTES) return fail("SNAPSHOT_TOO_LARGE"); try { const parsed = parseElectionDecisionSnapshotV1(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); if (!Buffer.from(bytes).equals(Buffer.from(encodeElectionDecisionSnapshotV1(parsed)))) return fail("NON_CANONICAL_BYTES"); return parsed; } catch (e) { if (e instanceof ElectionDecisionError) throw e; return fail("INVALID_CANONICAL_BYTES"); } }
export function electionDecisionSnapshotSha256(value: unknown): string { return createHash("sha256").update(encodeElectionDecisionSnapshotV1(value)).digest("hex"); }
