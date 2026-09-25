import { describe, expect, it } from "vitest";

import { readPriorityIndexRelease, validatePriorityIndexRelease } from "./priority-index-release";
import { FilesystemPriorityIndexRepository, rankAcrossChambers } from "./priority-index-store";

describe("priority index release and cross-chamber ranking", () => {
  it("reads the pinned release descriptor", () => {
    const release = readPriorityIndexRelease();
    expect(release).toMatchObject({ modelVersion: "v1.2", publishedAt: "2026-09-25", sourceCutoff: "2026-08-04", chambers: { house: { modelVersion: "v0.11", financeAsOf: "2026-09-24" }, senate: { modelVersion: "v0.1", sourceCutoff: "2026-09-24" } } });
    expect(() => validatePriorityIndexRelease({ ...release, modelVersion: "1.0" })).toThrow("PRIORITY_INDEX_RELEASE_VERSION_INVALID");
  });

  it("ranks House and Senate briefs in one list", () => {
    const repo = new FilesystemPriorityIndexRepository();
    const briefs = repo.getBriefs();
    expect(briefs).toHaveLength(530);
    expect(briefs.map((row) => row.rank)).toEqual(briefs.map((_, index) => index + 1));
    expect(briefs.filter((row) => row.chamber === "senate")).toHaveLength(100);
    expect(briefs.every((row) => Number.isInteger(row.nextElectionYear))).toBe(true);
    expect(repo.getModelRelease()).toEqual({ version: "v1.2", publishedAt: "2026-09-25", cutoffDate: "2026-08-04" });
    const senate = briefs.filter((row) => row.chamber === "senate");
    expect(senate.find((row) => row.districtLabel === "VT-S1")).toMatchObject({ incumbentParty: "Democratic", qualifyingRoute: "democratic_incumbent_primary", nextElectionYear: 2030 });
    expect(rankAcrossChambers(briefs.slice(0, 3).reverse()).map((row) => row.rank)).toEqual([1, 2, 3]);
  });
});
