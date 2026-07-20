import { describe, expect, it, vi } from "vitest";
import { executeFinalizeAcs, main, parseFinalizeAcsArguments } from "./finalize-acs";

const argv = ["--release", "rel_candidate", "--source-release", "rel_source", "--population-run", "run_population", "--age-run", "run_age", "--income-run", "run_income"];

describe("finalize ACS CLI", () => {
  it("requires every distinct argument and valid, different releases", () => {
    expect(parseFinalizeAcsArguments(argv)).toEqual({ release: "rel_candidate", sourceRelease: "rel_source", populationRun: "run_population", ageRun: "run_age", incomeRun: "run_income" });
    for (const invalid of [argv.slice(0, -2), [...argv, "--wat", "x"], [...argv.slice(0, -1), "run_age"], [...argv.slice(0, 4), "rel_candidate", ...argv.slice(5)]]) expect(() => parseFinalizeAcsArguments(invalid)).toThrow("Require exactly");
  });
  it("injects finalization with the complete lock checksum and emits stable nonsecret JSON", async () => {
    const finalize = vi.fn().mockResolvedValue(undefined), write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const rawStore = {} as never;
    const result = await executeFinalizeAcs(argv, { env: { NODE_ENV: "test", RAW_OBJECT_ROOT: ".raw" } as NodeJS.ProcessEnv, getPool: (() => ({}) as never), rawStore, finalize });
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ candidateReleaseId: "rel_candidate", sourceReleaseId: "rel_source", runIds: ["run_population", "run_age", "run_income"], sourceLockSha256: expect.stringMatching(/^[a-f0-9]{64}$/), sourceLockEntries: expect.arrayContaining([expect.objectContaining({ id: "acs-b01003", url: expect.any(String), sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteSize: expect.any(Number) })]) }));
    expect(result).toEqual({ release: "rel_candidate", sourceReleaseId: "rel_source", runIds: ["run_population", "run_age", "run_income"], status: "validated_candidate" });
    await main(argv, { NODE_ENV: "test", RAW_OBJECT_ROOT: ".raw" } as NodeJS.ProcessEnv, { getPool: (() => ({}) as never), rawStore, finalize });
    expect(write).toHaveBeenLastCalledWith('{"release":"rel_candidate","sourceReleaseId":"rel_source","runIds":["run_population","run_age","run_income"],"status":"validated_candidate"}\n');
    write.mockRestore();
  });
  it("requires all production dependencies without leaking secrets", async () => {
    await expect(executeFinalizeAcs(argv, { env: { NODE_ENV: "production", DATABASE_URL: "postgres://secret" }, getPool: (() => ({}) as never) })).rejects.not.toThrow("postgres://secret");
  });
});
