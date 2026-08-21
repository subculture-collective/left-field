import { describe, expect, it } from "vitest";

import { buildNationwideSourceRegistry } from "./nationwide-intake";
import { retainRawIntake, seedSourceRegistry } from "./repository";

const calls: Array<{ text: string; values: unknown[] }> = [];
const db = { query: async (text: string, values: unknown[] = []) => { calls.push({ text, values }); return { rowCount: 1, rows: [] }; } } as never;

describe("office-universe repository", () => {
  it("seeds all state source slots without touching federal release tables", async () => {
    calls.splice(0);
    await seedSourceRegistry(db, buildNationwideSourceRegistry());
    expect(calls).toHaveLength(250);
    expect(calls.every((call) => call.text.includes("office_universe.source_registrations") && !call.text.includes("data_releases"))).toBe(true);
  });

  it("retains an incomplete result and its quarantine issues independently", async () => {
    calls.splice(0);
    const result = await retainRawIntake(db, { sourceKey: "state-election-authority:IN", snapshotId: "snapshot_in", payloadSha256: "a".repeat(64), payloadLocator: "in/result.json", sourceNaturalKey: "IN:2026:HD01", kind: "result", observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD01" } });
    expect(result).toMatchObject({ disposition: "accepted", issueCount: 0 });
    expect(calls).toHaveLength(1);
    calls.splice(0);
    const quarantined = await retainRawIntake(db, { sourceKey: "state-election-authority:IN", snapshotId: "snapshot_in", payloadSha256: "b".repeat(64), payloadLocator: "../bad", sourceNaturalKey: null, kind: "result", observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD01" } });
    expect(quarantined.disposition).toBe("quarantined");
    expect(calls[0]!.text).toContain("office_universe.raw_payloads");
    expect(calls.slice(1).every((call) => call.text.includes("office_universe.intake_issues"))).toBe(true);
  });
});
