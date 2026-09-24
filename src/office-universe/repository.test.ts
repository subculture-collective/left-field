import { describe, expect, it } from "vitest";

import type { RawIntakeRecord } from "./nationwide-intake";
import { buildNationwideSourceRegistry } from "./nationwide-intake";
import { retainRawIntake, seedSourceRegistry } from "./repository";

type Call = { text: string; values: unknown[] };

function fakeDb(rowCount = 1) {
  const calls: Call[] = [];
  const db = { query: async (text: string, values: unknown[] = []) => { calls.push({ text, values }); return { rowCount, rows: [] }; } } as never;
  return { calls, db };
}

function fakePool(options: { failOn?: string } = {}) {
  const calls: Call[] = [];
  let released = 0;
  const client = {
    query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      if (options.failOn && text.includes(options.failOn)) throw new Error(`injected failure: ${options.failOn}`);
      return { rowCount: 1, rows: [] };
    },
    release: () => { released += 1; },
  };
  const pool = { connect: async () => client } as never;
  return { calls, pool, released: () => released };
}

const accepted: RawIntakeRecord = { sourceKey: "state-election-authority:IN", snapshotId: "snapshot_in", payloadSha256: "a".repeat(64), payloadLocator: "in/result.json", sourceNaturalKey: "IN:2026:HD01", kind: "result", observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD01" } };
const quarantined: RawIntakeRecord = { sourceKey: "state-election-authority:IN", snapshotId: "snapshot_in", payloadSha256: "b".repeat(64), payloadLocator: "../bad", sourceNaturalKey: null, kind: "result", observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD01" } };

describe("office-universe repository", () => {
  it("seeds all state source slots insert-only without touching federal release tables", async () => {
    const { calls, db } = fakeDb();
    const summary = await seedSourceRegistry(db, buildNationwideSourceRegistry());
    expect(summary).toEqual({ inserted: 250, existing: 0 });
    expect(calls).toHaveLength(250);
    expect(calls.every((call) => call.text.includes("office_universe.source_registrations") && !call.text.includes("data_releases"))).toBe(true);
    expect(calls.every((call) => call.text.includes("ON CONFLICT(state_code,family) DO NOTHING"))).toBe(true);
    expect(calls.some((call) => call.text.includes("DO UPDATE"))).toBe(false);
  });

  it("reports existing rows on reseed instead of resetting them", async () => {
    const { calls, db } = fakeDb(0);
    const summary = await seedSourceRegistry(db, buildNationwideSourceRegistry());
    expect(summary).toEqual({ inserted: 0, existing: 250 });
    expect(calls.some((call) => /DO UPDATE|updated_at|UPDATE\s+office_universe/i.test(call.text))).toBe(false);
  });

  it("retains an accepted record inside a transaction and releases the client", async () => {
    const { calls, pool, released } = fakePool();
    const result = await retainRawIntake(pool, accepted);
    expect(result).toMatchObject({ disposition: "accepted", issueCount: 0 });
    expect(calls.map((call) => call.text)).toEqual(["BEGIN", expect.stringContaining("office_universe.raw_payloads"), "COMMIT"]);
    expect(released()).toBe(1);
  });

  it("retains a quarantined record plus every issue atomically", async () => {
    const { calls, pool, released } = fakePool();
    const result = await retainRawIntake(pool, quarantined);
    expect(result.disposition).toBe("quarantined");
    expect(result.issueCount).toBeGreaterThan(0);
    const texts = calls.map((call) => call.text);
    expect(texts[0]).toBe("BEGIN");
    expect(texts[1]).toContain("office_universe.raw_payloads");
    expect(texts.at(-1)).toBe("COMMIT");
    const issueInserts = texts.slice(2, -1);
    expect(issueInserts).toHaveLength(result.issueCount);
    expect(issueInserts.every((text) => text.includes("office_universe.intake_issues"))).toBe(true);
    expect(texts.some((text) => /offices|seat_cycles|coverage|data_releases/.test(text))).toBe(false);
    expect(released()).toBe(1);
  });

  it("rolls back, rethrows, and releases when an issue insert fails", async () => {
    const { calls, pool, released } = fakePool({ failOn: "office_universe.intake_issues" });
    await expect(retainRawIntake(pool, quarantined)).rejects.toThrow("injected failure");
    const texts = calls.map((call) => call.text);
    expect(texts[0]).toBe("BEGIN");
    expect(texts.at(-1)).toBe("ROLLBACK");
    expect(texts).not.toContain("COMMIT");
    expect(released()).toBe(1);
  });

  it("rolls back, rethrows, and releases when the raw payload insert fails", async () => {
    const { calls, pool, released } = fakePool({ failOn: "office_universe.raw_payloads" });
    await expect(retainRawIntake(pool, accepted)).rejects.toThrow("injected failure");
    expect(calls.map((call) => call.text)).toEqual(["BEGIN", expect.stringContaining("office_universe.raw_payloads"), "ROLLBACK"]);
    expect(released()).toBe(1);
  });
});
