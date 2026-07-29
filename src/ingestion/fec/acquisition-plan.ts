import { createHash } from "node:crypto";
import { releaseIdSchema } from "@/domain/contracts";

export type FecPlanTarget =
  | Readonly<{ kind: "candidate_resolution_required"; seatCycleId: string }>
  | Readonly<{ kind: "terminal"; seatCycleId: string; disposition: "vacant" | "non_candidate" | "not_contested"; evidenceSha256: string }>;
export type FecAcquisitionPlanV2 = Readonly<{
  schemaVersion: 2;
  adapterVersion: "fec-receipt-cutoff-v2";
  releaseId: string;
  receiptCutoff: "2026-07-18";
  campaignCycle: 2026;
  sourceLockSha256: string;
  enumerationLowerBound: "2025-01-01";
  targetUniverseSha256: string;
  forms: readonly ("F3" | "F3X" | "F24" | "F5")[];
  enumeration: Readonly<{ granularity: "day"; serverOrderBy: "receipt_date"; clientCanonicalOrderBy: "file_number"; completePasses: 2 }>;
  targets: readonly FecPlanTarget[];
}>;
export type FecEnumerationPartition = Readonly<{ formType: "F3" | "F3X" | "F24" | "F5"; receiptDate: string; serverOrderBy: "receipt_date"; clientCanonicalOrderBy: "file_number" }>;

const MAX_BYTES = 256 * 1024;
const TARGET_COUNT = 541;
const FORMS = ["F24", "F3", "F3X", "F5"] as const;
const ENUMERATION = { granularity: "day", serverOrderBy: "receipt_date", clientCanonicalOrderBy: "file_number", completePasses: 2 } as const;
const ROOT_KEYS = ["schemaVersion", "adapterVersion", "releaseId", "receiptCutoff", "campaignCycle", "sourceLockSha256", "enumerationLowerBound", "targetUniverseSha256", "forms", "enumeration", "targets"] as const;
const EXPECTATION_KEYS = ["planSha256", "sourceLockSha256", "seatCycleIds"] as const;
const SHA256 = /^[a-f0-9]{64}$/;
// Local research plans use a deliberately distinct, non-seat namespace.
const SEAT_CYCLE_ID = /^(?:seat|local_fec_scope)_[a-z0-9]+(?:_[a-z0-9]+)*$/;
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: "FEC_PLAN_INPUT_TOO_LARGE" | "FEC_PLAN_INVALID_JSON" | "FEC_PLAN_INVALID" | "FEC_PLAN_UNKNOWN_FIELD" | "FEC_PLAN_NONCANONICAL" | "FEC_PLAN_EXPECTATION_MISMATCH"): never => { throw new Error(code); };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail("FEC_PLAN_INVALID");
const exact = (value: Record<string, unknown>, keys: readonly string[]): void => {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail("FEC_PLAN_UNKNOWN_FIELD");
};
const sha = (value: unknown): value is string => typeof value === "string" && SHA256.test(value);
const seatCycleId = (value: unknown): value is string => typeof value === "string" && value.length <= 128 && SEAT_CYCLE_ID.test(value);
const releaseId = (value: unknown): value is string => releaseIdSchema.safeParse(value).success;
const denseArray = (value: unknown): value is unknown[] => {
  if (!Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === value.length && keys.every((key, index) => key === String(index));
};

function targetUniverseIds(value: unknown): readonly string[] {
  if (!denseArray(value) || value.length !== TARGET_COUNT) fail("FEC_PLAN_INVALID");
  const values = value as unknown[];
  for (const id of values) {
    if (!seatCycleId(id)) fail("FEC_PLAN_INVALID");
  }
  const ids = [...values] as string[];
  ids.sort(bytewise);
  if (ids.some((id, index) => index > 0 && ids[index - 1] === id)) fail("FEC_PLAN_INVALID");
  return ids;
}

/** Hashes the canonical newline-terminated JSON representation of the target seat universe. */
export function fecTargetUniverseSha256(seatCycleIds: readonly string[]): string {
  const ids = targetUniverseIds(seatCycleIds);
  return createHash("sha256").update(Buffer.from(`${JSON.stringify(ids)}\n`)).digest("hex");
}

function validate(value: unknown): FecAcquisitionPlanV2 {
  const root = object(value);
  exact(root, ROOT_KEYS);
  if (root.schemaVersion !== 2 || root.adapterVersion !== "fec-receipt-cutoff-v2" || !releaseId(root.releaseId) || root.receiptCutoff !== "2026-07-18" || root.campaignCycle !== 2026 || !sha(root.sourceLockSha256) || root.enumerationLowerBound !== "2025-01-01" || !sha(root.targetUniverseSha256) || !denseArray(root.forms) || root.forms.length !== FORMS.length || !denseArray(root.targets)) fail("FEC_PLAN_INVALID");
  const forms = root.forms as unknown[];
  const rawTargets = root.targets as unknown[];
  if (!FORMS.every((form, index) => forms[index] === form)) fail("FEC_PLAN_INVALID");
  const enumeration = object(root.enumeration);
  exact(enumeration, ["granularity", "serverOrderBy", "clientCanonicalOrderBy", "completePasses"]);
  if (enumeration.granularity !== ENUMERATION.granularity || enumeration.serverOrderBy !== ENUMERATION.serverOrderBy || enumeration.clientCanonicalOrderBy !== ENUMERATION.clientCanonicalOrderBy || enumeration.completePasses !== ENUMERATION.completePasses) fail("FEC_PLAN_INVALID");
  const targets: FecPlanTarget[] = [];
  let previous = "";
  for (const raw of rawTargets) {
    const target = object(raw);
    if (target.kind === "candidate_resolution_required") {
      exact(target, ["kind", "seatCycleId"]);
      if (!seatCycleId(target.seatCycleId)) fail("FEC_PLAN_INVALID");
      targets.push({ kind: "candidate_resolution_required", seatCycleId: target.seatCycleId as string });
    } else if (target.kind === "terminal") {
      exact(target, ["kind", "seatCycleId", "disposition", "evidenceSha256"]);
      if (!seatCycleId(target.seatCycleId) || !(target.disposition === "vacant" || target.disposition === "non_candidate" || target.disposition === "not_contested") || !sha(target.evidenceSha256)) fail("FEC_PLAN_INVALID");
      targets.push({ kind: "terminal", seatCycleId: target.seatCycleId as string, disposition: target.disposition as "vacant" | "non_candidate" | "not_contested", evidenceSha256: target.evidenceSha256 as string });
    } else fail("FEC_PLAN_INVALID");
    const id = targets[targets.length - 1]!.seatCycleId;
    if (previous !== "" && bytewise(previous, id) >= 0) fail("FEC_PLAN_INVALID");
    previous = id;
  }
  const universe = fecTargetUniverseSha256(targets.map(target => target.seatCycleId));
  if (root.targetUniverseSha256 !== universe) fail("FEC_PLAN_INVALID");
  return { schemaVersion: 2, adapterVersion: "fec-receipt-cutoff-v2", releaseId: root.releaseId as string, receiptCutoff: "2026-07-18", campaignCycle: 2026, sourceLockSha256: root.sourceLockSha256 as string, enumerationLowerBound: "2025-01-01", targetUniverseSha256: root.targetUniverseSha256 as string, forms: [...FORMS], enumeration: { ...ENUMERATION }, targets };
}

export function encodeFecAcquisitionPlan(value: FecAcquisitionPlanV2): Uint8Array {
  const plan = validate(value);
  const canonical = { schemaVersion: 2, adapterVersion: "fec-receipt-cutoff-v2", releaseId: plan.releaseId, receiptCutoff: "2026-07-18", campaignCycle: 2026, sourceLockSha256: plan.sourceLockSha256, enumerationLowerBound: "2025-01-01", targetUniverseSha256: plan.targetUniverseSha256, forms: [...FORMS], enumeration: { ...ENUMERATION }, targets: plan.targets.map(target => target.kind === "candidate_resolution_required" ? { kind: "candidate_resolution_required" as const, seatCycleId: target.seatCycleId } : { kind: "terminal" as const, seatCycleId: target.seatCycleId, disposition: target.disposition, evidenceSha256: target.evidenceSha256 }) };
  const bytes = Buffer.from(`${JSON.stringify(canonical)}\n`);
  if (bytes.byteLength > MAX_BYTES) fail("FEC_PLAN_INPUT_TOO_LARGE");
  return bytes;
}

export function decodeFecAcquisitionPlan(bytes: Uint8Array, expected: { planSha256: string; sourceLockSha256: string; seatCycleIds: readonly string[] }): FecAcquisitionPlanV2 {
  if (bytes.byteLength > MAX_BYTES) fail("FEC_PLAN_INPUT_TOO_LARGE");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return fail("FEC_PLAN_INVALID_JSON"); }
  const expectation = object(expected);
  exact(expectation, EXPECTATION_KEYS);
  if (!sha(expectation.planSha256) || !sha(expectation.sourceLockSha256) || !denseArray(expectation.seatCycleIds) || fecAcquisitionPlanSha256(bytes) !== expectation.planSha256) fail("FEC_PLAN_EXPECTATION_MISMATCH");
  const plan = validate(raw);
  if (plan.sourceLockSha256 !== expectation.sourceLockSha256) fail("FEC_PLAN_EXPECTATION_MISMATCH");
  const expectedIds = targetUniverseIds(expectation.seatCycleIds);
  const expectedHash = fecTargetUniverseSha256(expectedIds);
  const targetIds = plan.targets.map(target => target.seatCycleId);
  if (expectedHash !== plan.targetUniverseSha256 || targetIds.length !== expectedIds.length || targetIds.some((id, index) => id !== expectedIds[index])) fail("FEC_PLAN_EXPECTATION_MISMATCH");
  if (!Buffer.from(bytes).equals(Buffer.from(encodeFecAcquisitionPlan(plan)))) fail("FEC_PLAN_NONCANONICAL");
  return plan;
}

export const fecAcquisitionPlanSha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export function deriveFecEnumerationPartitions(plan: FecAcquisitionPlanV2): readonly FecEnumerationPartition[] {
  validate(plan);
  const partitions: FecEnumerationPartition[] = [];
  const first = Date.UTC(2025, 0, 1), last = Date.UTC(2026, 6, 18), day = 24 * 60 * 60 * 1000;
  for (const formType of FORMS) for (let time = first; time <= last; time += day) partitions.push({ formType, receiptDate: new Date(time).toISOString().slice(0, 10), serverOrderBy: ENUMERATION.serverOrderBy, clientCanonicalOrderBy: ENUMERATION.clientCanonicalOrderBy });
  return partitions;
}
