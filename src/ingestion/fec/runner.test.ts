import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeFecAcquisitionPlan, fecAcquisitionPlanSha256, fecTargetUniverseSha256, type FecAcquisitionPlanV2 } from "./acquisition-plan";
import { readConfiguredFecPlan } from "./plan-reader";
import { validateConfiguredFecV2DryRun } from "./runner";

const ids = Array.from({ length: 541 }, (_, i) => `seat_runner_${String(i).padStart(3, "0")}`);
const plan = (): FecAcquisitionPlanV2 => ({ schemaVersion: 2, adapterVersion: "fec-receipt-cutoff-v2", releaseId: "rel_runner", receiptCutoff: "2026-07-18", campaignCycle: 2026, sourceLockSha256: "a".repeat(64), enumerationLowerBound: "2025-01-01", targetUniverseSha256: fecTargetUniverseSha256(ids), forms: ["F24", "F3", "F3X", "F5"], enumeration: { granularity: "day", serverOrderBy: "receipt_date", clientCanonicalOrderBy: "file_number", completePasses: 2 }, targets: ids.map(seatCycleId => ({ kind: "candidate_resolution_required", seatCycleId })) });
const fixture = async () => { const dir = await mkdtemp(join(tmpdir(), "fec-runner-")), bytes = encodeFecAcquisitionPlan(plan()), file = join(dir, "plan.json"); await writeFile(file, bytes); return { file, bytes }; };

describe("FEC V2 runner configuration boundary", () => {
  it("reads only a canonical confined regular plan", async () => {
    const { file, bytes } = await fixture(), expected = { planSha256: fecAcquisitionPlanSha256(bytes), sourceLockSha256: "a".repeat(64), seatCycleIds: ids };
    await expect(readConfiguredFecPlan({ path: file, expected })).resolves.toMatchObject({ releaseId: "rel_runner" });
    const link = `${file}.link`; await symlink(file, link);
    await expect(readConfiguredFecPlan({ path: link, expected })).rejects.toThrow("FEC_V2_PLAN_FILE_INVALID");
  });

  it("dry run has no store, database, network, or mutation dependency", async () => {
    const { file, bytes } = await fixture();
    await expect(validateConfiguredFecV2DryRun({ planPath: file, apiKey: "present", deadlineMs: Date.now() + 10_000, expectation: { planSha256: fecAcquisitionPlanSha256(bytes), sourceLockSha256: "a".repeat(64), seatCycleIds: ids } })).resolves.toEqual({ releaseId: "rel_runner", planSha256: fecAcquisitionPlanSha256(bytes) });
  });

  it("rejects deadlines beyond the bounded six-hour lease window", async () => {
    const { file, bytes } = await fixture();
    await expect(validateConfiguredFecV2DryRun({ planPath: file, apiKey: "present", deadlineMs: Date.now() + 6 * 60 * 60_000 + 60_000, expectation: { planSha256: fecAcquisitionPlanSha256(bytes), sourceLockSha256: "a".repeat(64), seatCycleIds: ids } })).rejects.toThrow("FEC_V2_CONFIGURATION_INVALID");
  });
});
