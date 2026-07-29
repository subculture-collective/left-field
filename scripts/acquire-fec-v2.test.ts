import { describe, expect, it, vi } from "vitest";
import { executeAcquireFecV2, parseAcquireFecV2Arguments } from "./acquire-fec-v2";

describe("acquire-fec-v2 CLI", () => {
  it("accepts exactly its required flags", () => {
    expect(parseAcquireFecV2Arguments(["--release", "rel_a", "--cutoff", "2026-07-18", "--plan", "/safe/plan.json"])).toEqual({ release: "rel_a", cutoff: "2026-07-18", planPath: "/safe/plan.json" });
    for (const argv of [["--release", "rel_a"], ["--release", "rel_a", "--cutoff", "2026-07-19", "--plan", "x"], ["--release", "rel_a", "--cutoff", "2026-07-18", "--plan", "x", "--dry-run"]]) expect(() => parseAcquireFecV2Arguments(argv)).toThrow();
  });
  it("uses the shared configured runner once", async () => {
    const run = vi.fn().mockResolvedValue({ loadedRunIds: ["run"], reusedRunIds: [], failedRunIds: [] });
    await expect(executeAcquireFecV2(["--release", "rel_a", "--cutoff", "2026-07-18", "--plan", "plan"], {} as NodeJS.ProcessEnv, run)).resolves.toEqual({ source: "fec", release: "rel_a", runIds: ["run"], reusedRunIds: [] });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
