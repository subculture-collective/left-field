import { describe, expect, it } from "vitest";

import { buildStateLegislativeRoster, districtKey, parseCsv, readStateLegislativeRoster } from "./state-legislative-roster";

describe("state-legislative roster", () => {
  it("normalizes district keys and reads quoted CSV", () => {
    expect(districtKey("007")).toBe("7");
    expect(districtKey("Rockingham 13")).toBe("rockingham 13");
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
  });

  it("covers every jurisdiction and joins primary evidence only through the identity gate", () => {
    const value = buildStateLegislativeRoster();
    expect(value.summary).toMatchObject({ jurisdictions: 51, chambers: 100, catalogStates: 10 });
    expect(value.summary.legislators).toBe(value.rows.length);
    expect(value.rows.filter((row) => row.stateCode === "NE").every((row) => row.chamber === "unicameral")).toBe(true);
    const matched = value.rows.filter((row) => row.primaryEvidence.status === "matched");
    expect(matched.length).toBe(value.summary.primaryMatched);
    expect(matched.every((row) => row.party === "Democratic" && row.primaryEvidence.incumbentVoteShare !== null && row.primaryEvidence.primaryFeasibility === Math.round((100 - row.primaryEvidence.incumbentVoteShare) * 10) / 10)).toBe(true);
    expect(value.rows.filter((row) => row.stateCode === "CA").every((row) => row.primaryEvidence.status === "no_catalog_for_state")).toBe(true);
    expect(readStateLegislativeRoster().packageSha256).toBe(value.packageSha256);
  });
});
