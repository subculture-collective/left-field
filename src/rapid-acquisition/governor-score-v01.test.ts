import { describe, expect, it } from "vitest";

import { buildGovernorScoreV01Projection, readGovernorScoreV01Projection } from "./governor-score-v01";
import { parseExecutiveYaml } from "./openstates-executive";

describe("governor score v0.1", () => {
  it("reads the Open States executive YAML subset and skips nested detail", () => {
    const person = parseExecutiveYaml(["id: ocd-person/abc", "name: Jane Doe", "given_name: Jane", "family_name: Doe", "party:", "- name: Democratic-Farmer-Labor", "roles:", "- start_date: '2023-01-02'", "  end_date: '2027-01-04'", "  type: governor", "  jurisdiction: ocd-jurisdiction/country:us/state:mn/government", "offices:", "- classification: capitol", "  address: 1 Capitol", "ids:", "  twitter: jane", "sources:", "- url: https://example.org"].join("\n"), "test");
    expect(person).toMatchObject({ id: "ocd-person/abc", name: "Jane Doe", parties: ["Democratic-Farmer-Labor"] });
    expect(person.roles).toEqual([{ type: "governor", startDate: "2023-01-02", endDate: "2027-01-04", jurisdiction: "ocd-jurisdiction/country:us/state:mn/government" }]);
  });

  it("closes over fifty governors with the 2026 cycle and reads back through the lock", () => {
    const value = buildGovernorScoreV01Projection();
    expect(value.summary).toMatchObject({ seats: 50, upIn2026: 36 });
    expect(value.summary.democraticCaucus + value.summary.republicanCaucus).toBe(50);
    expect(value.rows.find((row) => row.stateCode === "MN")).toMatchObject({ incumbentParty: "Democratic-Farmer-Labor", caucus: "Democratic" });
    expect(value.rows.every((row) => row.drivers.every((driver) => driver.key !== "cash_vulnerability" || driver.score === null))).toBe(true);
    expect(readGovernorScoreV01Projection().packageSha256).toBe(value.packageSha256);
  });
});
