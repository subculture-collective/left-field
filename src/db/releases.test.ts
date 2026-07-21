import { describe, expect, it, vi } from "vitest";
import { assertElectionPublicationReadiness } from "./releases";

const client = (row: Record<string, string | number>) => ({
  query: vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 }),
});

describe("election publication readiness", () => {
  it("preserves publication compatibility for legacy all-unassessed releases", async () => {
    const connection = client({ reviewed_any: "0", unassessed_any: "158", reviewed: "0", unassessed: "102", alaska_approved: "0", approved_without_results: "0" });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_legacy")).resolves.toBe(false);
  });

  it("rejects a partially reviewed cohort", async () => {
    const connection = client({ reviewed_any: "1", unassessed_any: "157", reviewed: "1", unassessed: "101", alaska_approved: "1", approved_without_results: "0" });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_partial")).rejects.toThrow("failed election publication readiness");
  });

  it("rejects a reviewed 2022 decision when the complete cohort remains unreviewed", async () => {
    const connection = client({ reviewed_any: 1, unassessed_any: 157, reviewed: 0, unassessed: 102, alaska_approved: 0, approved_without_results: 0 });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_2022_partial")).rejects.toThrow("failed election publication readiness");
  });

  it("rejects reviewed closure without both Alaska cycles and approved-result closure", async () => {
    for (const row of [
      { reviewed_any: 158, unassessed_any: 0, reviewed: 102, unassessed: 0, alaska_approved: 1, approved_without_results: 0 },
      { reviewed_any: 158, unassessed_any: 0, reviewed: 102, unassessed: 0, alaska_approved: 2, approved_without_results: 1 },
    ]) {
      await expect(assertElectionPublicationReadiness(client(row) as never, "rel_incomplete")).rejects.toThrow("failed election publication readiness");
    }
  });

  it("accepts the fully reviewed cohort with approved-result closure", async () => {
    const connection = client({ reviewed_any: 158, unassessed_any: 0, reviewed: 102, unassessed: 0, alaska_approved: 2, approved_without_results: 0 });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_r3")).resolves.toBe(true);
  });
});
