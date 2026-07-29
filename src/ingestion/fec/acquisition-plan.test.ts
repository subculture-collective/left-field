import { describe, expect, it } from "vitest";
import { decodeFecAcquisitionPlan, deriveFecEnumerationPartitions, encodeFecAcquisitionPlan, fecAcquisitionPlanSha256, fecTargetUniverseSha256, type FecAcquisitionPlanV2 } from "./acquisition-plan";

const sourceLockSha256 = "a".repeat(64);
const ids = Array.from({ length: 541 }, (_, index) => `seat_test_${String(index).padStart(3, "0")}`);
const ERROR_CODE = /^FEC_PLAN_(INPUT_TOO_LARGE|INVALID_JSON|INVALID|UNKNOWN_FIELD|NONCANONICAL|EXPECTATION_MISMATCH)$/;
const plan = (): FecAcquisitionPlanV2 => {
  const targets = ids.map((seatCycleId, index) => index % 2 === 0 ? { kind: "candidate_resolution_required" as const, seatCycleId } : { kind: "terminal" as const, seatCycleId, disposition: index % 3 === 0 ? "vacant" as const : index % 3 === 1 ? "non_candidate" as const : "not_contested" as const, evidenceSha256: "b".repeat(64) });
  return { schemaVersion: 2, adapterVersion: "fec-receipt-cutoff-v2", releaseId: "rel_plan", receiptCutoff: "2026-07-18", campaignCycle: 2026, sourceLockSha256, enumerationLowerBound: "2025-01-01", targetUniverseSha256: fecTargetUniverseSha256(ids), forms: ["F24", "F3", "F3X", "F5"], enumeration: { granularity: "day", serverOrderBy: "receipt_date", clientCanonicalOrderBy: "file_number", completePasses: 2 }, targets };
};
const canonicalJson = (value: object): Uint8Array => Buffer.from(`${JSON.stringify(value)}\n`);
const expectation = (bytes: Uint8Array) => ({ planSha256: fecAcquisitionPlanSha256(bytes), sourceLockSha256, seatCycleIds: ids });
const decode = (bytes: Uint8Array) => decodeFecAcquisitionPlan(bytes, expectation(bytes));
const expectRejected = (action: () => unknown, canary = false): void => {
  try { action(); } catch (error) {
    const message = (error as Error).message;
    expect(message).toMatch(ERROR_CODE);
    if (canary) expect(message).not.toContain("CANARY_SECRET");
    return;
  }
  throw new Error("expected rejection");
};

describe("FEC acquisition plan", () => {
  it("round trips the complete canonical target universe with pinned hash snapshots", () => {
    const bytes = encodeFecAcquisitionPlan(plan());
    expect(Buffer.from(bytes).toString().endsWith("\n")).toBe(true);
    expect(fecAcquisitionPlanSha256(bytes)).toBe("1c3d6c61bd25ab59f471f09f3d4da0ecb126984855e1ec94ddb286f9cceeb454");
    expect(fecTargetUniverseSha256(ids)).toBe("660f961568654935252f112f46d4c23640ba60f806200914030f194ead8e109b");
    expect(decode(bytes)).toEqual(plan());
    expect(encodeFecAcquisitionPlan(decode(bytes))).toEqual(bytes);
  });

  it("derives all 2,256 UTC partitions in the independent canonical sequence", () => {
    const partitions = deriveFecEnumerationPartitions(plan());
    const expected = ["F24", "F3", "F3X", "F5"].flatMap(formType => Array.from({ length: 564 }, (_, day) => ({ formType, receiptDate: new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10), serverOrderBy: "receipt_date", clientCanonicalOrderBy: "file_number" })));
    expect(partitions).toEqual(expected);
  });

  it("rejects pinned-digest, semantic, canonical, and sparse-array attacks without leakage", () => {
    const bytes = encodeFecAcquisitionPlan(plan());
    const parsed = JSON.parse(Buffer.from(bytes).toString());
    const originalExpectation = expectation(bytes);
    const decisionMutation = canonicalJson({ ...parsed, targets: [{ ...parsed.targets[0], kind: "terminal", disposition: "vacant", evidenceSha256: "c".repeat(64) }, ...parsed.targets.slice(1)] });
    expect(() => decodeFecAcquisitionPlan(decisionMutation, originalExpectation)).toThrow("FEC_PLAN_EXPECTATION_MISMATCH");
    expectRejected(() => decodeFecAcquisitionPlan(bytes, { ...originalExpectation, planSha256: "A".repeat(64) }));
    expectRejected(() => decodeFecAcquisitionPlan(bytes, { ...originalExpectation, sourceLockSha256: "c".repeat(64) }));
    expectRejected(() => decodeFecAcquisitionPlan(bytes, { ...originalExpectation, seatCycleIds: [...ids.slice(0, -1), "seat_test_zzz"] }));
    for (const value of [
      { ...parsed, targetUniverseSha256: "c".repeat(64) },
      { ...parsed, forms: ["F3", "F24", "F3X", "F5"] },
      { ...parsed, targets: [...parsed.targets.slice(0, -1), parsed.targets[0]] },
      { ...parsed, targets: parsed.targets.slice(1) },
      { ...parsed, targets: [...parsed.targets, { ...parsed.targets[parsed.targets.length - 1] }] },
      ...["candidateId", "candidacyId", "reason", "secret", "api_key", "privateKey"].map(field => ({ ...parsed, targets: [{ ...parsed.targets[0], [field]: "CANARY_SECRET" }, ...parsed.targets.slice(1)] })),
      { ...parsed, targets: [{ ...parsed.targets[0], seatCycleId: "Seat_bad" }, ...parsed.targets.slice(1)] },
      { ...parsed, targets: [parsed.targets[0], { ...parsed.targets[1], evidenceSha256: "B".repeat(64) }, ...parsed.targets.slice(2)] },
      { ...parsed, sourceLockSha256: "A".repeat(64) }, { ...parsed, campaignCycle: "2026" }, { ...parsed, receiptCutoff: "2026-07-19" }, { ...parsed, enumeration: { ...parsed.enumeration, completePasses: 1 } },
    ]) {
      const mutant = canonicalJson(value);
      expectRejected(() => decode(mutant), JSON.stringify(value).includes("CANARY_SECRET"));
    }
    for (const mutant of [Buffer.from(` ${Buffer.from(bytes).toString()}`), Buffer.from(Buffer.from(bytes).toString().replace("\n", "")), Buffer.from(Buffer.from(bytes).toString().replace('"schemaVersion":2', '"adapterVersion":"fec-receipt-cutoff-v2","schemaVersion":2')), new Uint8Array([...bytes, 0xc3]), new Uint8Array(256 * 1024 + 1)]) expectRejected(() => decode(mutant));
    const sparseForms = [...plan().forms] as unknown[]; delete sparseForms[1];
    const sparseTargets = [...plan().targets] as unknown[]; delete sparseTargets[1];
    const formsWithProperty = [...plan().forms] as unknown[] & { unexpected?: string }; formsWithProperty.unexpected = "CANARY_SECRET";
    const targetsWithProperty = [...plan().targets] as unknown[] & { unexpected?: string }; targetsWithProperty.unexpected = "CANARY_SECRET";
    for (const value of [{ ...plan(), forms: sparseForms }, { ...plan(), targets: sparseTargets }, { ...plan(), forms: formsWithProperty }, { ...plan(), targets: targetsWithProperty }]) expectRejected(() => encodeFecAcquisitionPlan(value as FecAcquisitionPlanV2), value.forms === formsWithProperty || value.targets === targetsWithProperty);
    const sparseIds = [...ids] as unknown[]; delete sparseIds[1];
    expectRejected(() => fecTargetUniverseSha256(sparseIds as string[]));
    const idsWithProperty = [...ids] as unknown[] & { unexpected?: string }; idsWithProperty.unexpected = "CANARY_SECRET";
    expectRejected(() => decodeFecAcquisitionPlan(bytes, { ...originalExpectation, seatCycleIds: idsWithProperty as string[] }), true);
  });
});
