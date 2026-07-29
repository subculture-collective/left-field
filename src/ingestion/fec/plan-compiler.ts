import {
  decodeFecAcquisitionPlan,
  encodeFecAcquisitionPlan,
  fecAcquisitionPlanSha256,
  fecTargetUniverseSha256,
  type FecAcquisitionPlanV2,
  type FecPlanTarget,
} from "./acquisition-plan";

export type FecPlanCompilationInput = Readonly<{
  schemaVersion: 1;
  releaseId: string;
  receiptCutoff: "2026-07-18";
  campaignCycle: 2026;
  sourceLockSha256: string;
  targets: readonly FecPlanTarget[];
}>;

export type FecPlanReviewManifest = Readonly<{
  schemaVersion: 1;
  releaseId: string;
  planSha256: string;
  sourceLockSha256: string;
  targetUniverseSha256: string;
  receiptCutoff: "2026-07-18";
  campaignCycle: 2026;
  targetCount: 541;
  targetCounts: Readonly<{
    candidateResolutionRequired: number;
    vacant: number;
    nonCandidate: number;
    notContested: number;
  }>;
}>;

export type CompiledFecPlan = Readonly<{
  planBytes: Uint8Array;
  manifestBytes: Uint8Array;
  manifest: FecPlanReviewManifest;
}>;

const ROOT_KEYS = [
  "schemaVersion",
  "releaseId",
  "receiptCutoff",
  "campaignCycle",
  "sourceLockSha256",
  "targets",
] as const;
const SHA256 = /^[a-f0-9]{64}$/;

const fail = (): never => {
  throw new Error("FEC_PLAN_COMPILATION_INVALID");
};

const bytewise = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left), Buffer.from(right));

function parseInput(value: unknown): FecPlanCompilationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== ROOT_KEYS.length
    || ROOT_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(input, key))
    || input.schemaVersion !== 1
    || input.receiptCutoff !== "2026-07-18"
    || input.campaignCycle !== 2026
    || typeof input.releaseId !== "string"
    || !SHA256.test(String(input.sourceLockSha256))
    || !Array.isArray(input.targets)
    || input.targets.length !== 541
  ) fail();

  const targets = input.targets as unknown[];
  let previous = "";
  for (const rawTarget of targets) {
    if (!rawTarget || typeof rawTarget !== "object" || Array.isArray(rawTarget)) fail();
    const target = rawTarget as Record<string, unknown>;
    const seatCycleId = target.seatCycleId;
    if (typeof seatCycleId !== "string") throw new Error("FEC_PLAN_COMPILATION_INVALID");
    if (previous && bytewise(previous, seatCycleId) >= 0) fail();
    previous = seatCycleId;
  }
  return { ...input, targets } as unknown as FecPlanCompilationInput;
}

export function compileFecAcquisitionPlan(value: unknown): CompiledFecPlan {
  const input = parseInput(value);
  const seatCycleIds = input.targets.map((target) => target.seatCycleId);
  const targetUniverseSha256 = fecTargetUniverseSha256(seatCycleIds);
  const plan: FecAcquisitionPlanV2 = {
    schemaVersion: 2,
    adapterVersion: "fec-receipt-cutoff-v2",
    releaseId: input.releaseId,
    receiptCutoff: "2026-07-18",
    campaignCycle: 2026,
    sourceLockSha256: input.sourceLockSha256,
    enumerationLowerBound: "2025-01-01",
    targetUniverseSha256,
    forms: ["F24", "F3", "F3X", "F5"],
    enumeration: {
      granularity: "day",
      serverOrderBy: "receipt_date",
      clientCanonicalOrderBy: "file_number",
      completePasses: 2,
    },
    targets: input.targets,
  };
  const planBytes = encodeFecAcquisitionPlan(plan);
  const planSha256 = fecAcquisitionPlanSha256(planBytes);

  // Compile through the same strict expectation boundary used by acquisition.
  decodeFecAcquisitionPlan(planBytes, {
    planSha256,
    sourceLockSha256: input.sourceLockSha256,
    seatCycleIds,
  });

  const targetCounts = {
    candidateResolutionRequired: input.targets.filter((target) => target.kind === "candidate_resolution_required").length,
    vacant: input.targets.filter((target) => target.kind === "terminal" && target.disposition === "vacant").length,
    nonCandidate: input.targets.filter((target) => target.kind === "terminal" && target.disposition === "non_candidate").length,
    notContested: input.targets.filter((target) => target.kind === "terminal" && target.disposition === "not_contested").length,
  };
  const manifest: FecPlanReviewManifest = {
    schemaVersion: 1,
    releaseId: input.releaseId,
    planSha256,
    sourceLockSha256: input.sourceLockSha256,
    targetUniverseSha256,
    receiptCutoff: "2026-07-18",
    campaignCycle: 2026,
    targetCount: 541,
    targetCounts,
  };
  return {
    planBytes,
    manifest,
    manifestBytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
  };
}
