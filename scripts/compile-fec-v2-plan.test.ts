import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decodeFecAcquisitionPlan, fecAcquisitionPlanSha256 } from "@/ingestion/fec/acquisition-plan";
import { compileFecAcquisitionPlan } from "@/ingestion/fec/plan-compiler";
import { executeCompileFecV2Plan, parseCompileFecV2PlanArguments } from "./compile-fec-v2-plan";

const directories: string[] = [];
const ids = Array.from({ length: 541 }, (_, index) => `seat_review_${String(index).padStart(3, "0")}`);
const sourceLockSha256 = "a".repeat(64);
const input = () => ({
  schemaVersion: 1,
  releaseId: "rel_reviewed_fec",
  receiptCutoff: "2026-07-18",
  campaignCycle: 2026,
  sourceLockSha256,
  targets: ids.map((seatCycleId, index) => index < 4
    ? { kind: "terminal", seatCycleId, disposition: "vacant", evidenceSha256: "b".repeat(64) }
    : { kind: "candidate_resolution_required", seatCycleId }),
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("FEC v2 plan compiler", () => {
  it("emits stable canonical bytes and a complete non-secret review manifest", () => {
    const first = compileFecAcquisitionPlan(input());
    const equivalent = compileFecAcquisitionPlan(JSON.parse(JSON.stringify(input())));
    expect(first.planBytes).toEqual(equivalent.planBytes);
    expect(first.manifestBytes).toEqual(equivalent.manifestBytes);
    expect(first.manifest).toMatchObject({
      planSha256: fecAcquisitionPlanSha256(first.planBytes),
      sourceLockSha256,
      targetCount: 541,
      targetCounts: { candidateResolutionRequired: 537, vacant: 4, nonCandidate: 0, notContested: 0 },
    });
    expect(Buffer.from(first.planBytes).toString()).toMatch(/\n$/);
    expect(Buffer.from(first.manifestBytes).toString()).toMatch(/\n$/);
    expect(decodeFecAcquisitionPlan(first.planBytes, {
      planSha256: first.manifest.planSha256,
      sourceLockSha256,
      seatCycleIds: ids,
    }).releaseId).toBe("rel_reviewed_fec");
  });

  it("rejects incomplete, expanded, duplicate, unordered, changed-contract, and invalid terminal input", () => {
    const base = input();
    for (const mutant of [
      { ...base, targets: base.targets.slice(1) },
      { ...base, targets: [...base.targets, { kind: "candidate_resolution_required", seatCycleId: "seat_review_zzz" }] },
      { ...base, targets: [...base.targets.slice(0, -1), base.targets[0]] },
      { ...base, targets: [base.targets[1], base.targets[0], ...base.targets.slice(2)] },
      { ...base, receiptCutoff: "2026-07-19" },
      { ...base, campaignCycle: 2024 },
      { ...base, sourceLockSha256: "A".repeat(64) },
      { ...base, targets: [{ kind: "terminal", seatCycleId: ids[0], disposition: "unknown", evidenceSha256: "b".repeat(64) }, ...base.targets.slice(1)] },
      { ...base, targets: [{ kind: "terminal", seatCycleId: ids[0], disposition: "vacant", evidenceSha256: "B".repeat(64) }, ...base.targets.slice(1)] },
    ]) expect(() => compileFecAcquisitionPlan(mutant)).toThrow(/^FEC_PLAN_/);
  });

  it("writes once, verifies exact retries, and rejects plan-file replacement", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dsa-seats-plan-"));
    directories.push(directory);
    const inputPath = join(directory, "input.json"), planPath = join(directory, "plan.json"), manifestPath = join(directory, "manifest.json");
    await writeFile(inputPath, JSON.stringify(input()));
    const argv = ["--input", inputPath, "--plan", planPath, "--manifest", manifestPath];
    await expect(executeCompileFecV2Plan(argv)).resolves.toMatchObject({ plan: "written", manifest: "written" });
    await expect(executeCompileFecV2Plan(argv)).resolves.toMatchObject({ plan: "verified", manifest: "verified" });
    await writeFile(planPath, "{}\n");
    await expect(executeCompileFecV2Plan(argv)).rejects.toThrow("FEC_PLAN_OUTPUT_CONFLICT");
    expect(JSON.parse(await readFile(manifestPath, "utf8")).targetCount).toBe(541);
  });

  it("accepts only three distinct explicit paths", () => {
    expect(parseCompileFecV2PlanArguments(["--input", "input", "--plan", "plan", "--manifest", "manifest"])).toEqual({ inputPath: "input", planPath: "plan", manifestPath: "manifest" });
    expect(() => parseCompileFecV2PlanArguments(["--input", "same", "--plan", "same", "--manifest", "manifest"])).toThrow();
    expect(() => parseCompileFecV2PlanArguments(["--input", "input", "--plan", "plan"])).toThrow();
  });
});
