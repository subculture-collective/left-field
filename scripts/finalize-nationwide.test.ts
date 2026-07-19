import { describe, expect, it, vi } from "vitest";
import { executeFinalize, main, parseFinalizeArguments } from "./finalize-nationwide";

describe("nationwide finalization CLI", () => {
  it("strictly parses and invokes the candidate finalizer without publishing", async () => {
    expect(parseFinalizeArguments(["--release", "rel_a", "--identity-run", "run_i", "--tiger-run", "run_t"])).toEqual({ release: "rel_a", identityRun: "run_i", tigerRun: "run_t" });
    expect(() => parseFinalizeArguments(["--release", "rel_a", "--identity-run", "run_i"])).toThrow();
    const finalize = vi.fn(); const getPool = vi.fn(() => ({}));
    await expect(executeFinalize(["--release", "rel_a", "--identity-run", "run_i", "--tiger-run", "run_t"], { env: { NODE_ENV: "development", RAW_OBJECT_ROOT: ".raw" }, getPool: getPool as never, finalize })).resolves.toEqual({ release: "rel_a", identityRunId: "run_i", tigerRunId: "run_t", status: "finalized" });
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ releaseId: "rel_a", identityRunId: "run_i", tigerRunId: "run_t" }));
  });
  it("writes a stable finalization success line", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await main(["--release", "rel_a", "--identity-run", "run_i", "--tiger-run", "run_t"], { NODE_ENV: "development", RAW_OBJECT_ROOT: ".raw" }, { getPool: (() => ({})) as never, finalize: vi.fn() });
    expect(write).toHaveBeenCalledWith('{"release":"rel_a","identityRunId":"run_i","tigerRunId":"run_t","status":"finalized"}\n');
    write.mockRestore();
  });
});
