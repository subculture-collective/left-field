import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHouseRoster, reconcileHouseRoster, toStagedIdentityRow, type HouseSeat } from "./house";
import { parseSenateRoster, reconcileSenateRoster, type SenateServiceStartMap, type SenateSeat } from "./senate";

const houseMember = (district: string, id: string, name = "Example Member", dates = "<elected-date date=\"20241105\"/><sworn-date date=\"20250103\"/>") => `<member><statedistrict>${district}</statedistrict><member-info><official-name>${name}</official-name><bioguideID>${id}</bioguideID><party>D</party>${dates}</member-info></member>`;
const houseShell = (district: string) => `<member><statedistrict>${district}</statedistrict><member-info/></member>`;
const house = (...members: string[]) => `<MemberData><members>${members.join("")}</members></MemberData>`;
const senator = (state: string, klass: string, id: string, first = "Ada") => `<member><first_name>${first}</first_name><last_name>Example</last_name><party>I</party><state>${state}</state><class>${klass}</class><bioguide_id>${id}</bioguide_id></member>`;
const senate = (...members: string[]) => `<contact_information>${members.join("")}</contact_information>`;
const noSenate = { noSenateJurisdictions: new Set(["DC", "PR", "AS", "GU", "MP", "VI"]) };

const stateDistrictCounts: Record<string, number> = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };
const houseUniverse = (): HouseSeat[] => [
  ...Object.entries(stateDistrictCounts).flatMap(([state, count]) => Array.from({ length: count }, (_, index) => ({ stateCode: state, districtCode: (count === 1 ? "AL" : String(index + 1).padStart(2, "0")) as HouseSeat["districtCode"], kind: "representative" as const }))),
  ...(["DC", "AS", "GU", "MP", "VI"] as const).map(stateCode => ({ stateCode, districtCode: "AL" as const, kind: "delegate" as const })),
  { stateCode: "PR", districtCode: "AL" as const, kind: "resident_commissioner" as const },
];
const senateUniverse = (): SenateSeat[] => Object.keys(stateDistrictCounts).flatMap(stateCode => (stateCode === "CA" ? [1, 3] : [1, 2]).map(senateClass => ({ stateCode, senateClass: senateClass as 1 | 2 | 3, termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" })));

describe("official identity adapters", () => {
  it("normalizes voting, at-large, and all delegate/resident commissioner jurisdictions", () => {
    const result = parseHouseRoster(house(houseMember("CA12", "A000001"), houseMember("AK00", "B000002"), houseMember("DC00", "C000003"), houseMember("AQ00", "D000004"), houseMember("GU00", "E000005"), houseMember("MP00", "F000006"), houseMember("VI00", "G000007"), houseMember("PR00", "H000008")));
    expect(result.errors).toEqual([]);
    expect(result.records.map(row => [row.office.stateCode, row.office.districtCode, row.office.kind])).toEqual([["CA", "12", "representative"], ["AK", "AL", "representative"], ["DC", "AL", "delegate"], ["AS", "AL", "delegate"], ["GU", "AL", "delegate"], ["MP", "AL", "delegate"], ["VI", "AL", "delegate"], ["PR", "AL", "resident_commissioner"]]);
    expect(toStagedIdentityRow(result.records[0]!)).toMatchObject({ membership: { swornAt: "2025-01-03", serviceStartedAt: "2025-01-03" }, redactedExtras: {} });
  });

  it("uses half-open current-term membership while retaining the actual service start", () => {
    const universe = [{ stateCode: "CA", districtCode: "01" as const, kind: "representative" as const, termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" }];
    const incumbent = reconcileHouseRoster(house(houseMember("CA01", "A000001", "Long Serving", "<sworn-date date=\"20190103\"/>")), universe);
    expect(incumbent.errors).toEqual([]);
    expect(incumbent.records[0]?.membership).toMatchObject({ serviceStartedAt: "2019-01-03", termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" });
    const appointment = reconcileHouseRoster(house(houseMember("CA01", "A000001", "Appointed", "<sworn-date date=\"20250201\"/>")), universe);
    expect(appointment.records[0]?.membership?.termStartsAt).toBe("2025-02-01");
    expect(reconcileHouseRoster(house(houseMember("CA01", "A000001", "Late", "<sworn-date date=\"20270103\"/>")), universe).errors.map(issue => issue.code)).toContain("MALFORMED_DATE");
    expect(reconcileHouseRoster(house(houseMember("CA01", "A000001")), universe, "2025-01-02").errors.map(issue => issue.code)).toContain("MALFORMED_DATE");
  });

  it("emits vacancies for valid Clerk shells but blocks malformed occupied rows", () => {
    const universe = [{ stateCode: "CA", districtCode: "01" as const, kind: "representative" as const }, { stateCode: "CA", districtCode: "02" as const, kind: "representative" as const }];
    const shell = reconcileHouseRoster(house(houseShell("CA01")), universe);
    expect(shell.errors).toEqual([]);
    expect(shell.records).toHaveLength(2);
    expect(shell.records.every(row => row.person === null)).toBe(true);
    const malformed = reconcileHouseRoster(house(houseMember("CA01", "bad")), universe);
    expect(malformed.errors.map(issue => issue.code)).toContain("MALFORMED_BIOGUIDE");
    expect(malformed.records.find(row => row.sourceNaturalKey === "house:CA:01")).toBeUndefined();
  });

  it("rejects unsafe XML, invalid calendar dates, invalid half-open terms, and duplicate universe seats", () => {
    expect(parseHouseRoster("<MemberData><members><member>").errors[0]?.code).toBe("MALFORMED_XML");
    expect(parseHouseRoster("<!DOCTYPE x [<!ENTITY x 'y'>]><MemberData/>").errors[0]?.code).toBe("MALFORMED_XML");
    expect(parseHouseRoster(house(houseMember("CA01", "A000001", "Name", "<sworn-date date=\"20250230\"/>"))).errors.map(issue => issue.code)).toContain("MALFORMED_DATE");
    const invalid = reconcileHouseRoster(house(), [{ stateCode: "CA", districtCode: "01", kind: "representative", termStartsAt: "2025-02-30" }, { stateCode: "CA", districtCode: "01", kind: "representative", termStartsAt: "2025-01-03", termEndsAt: "2025-01-03" }]);
    expect(invalid.errors.map(issue => issue.code)).toEqual(expect.arrayContaining(["UNIVERSE_INCONSISTENCY"]));
  });

  it("reconciles a source-locked Senate appointment start against the current term", () => {
    const result = reconcileSenateRoster(senate(senator("CA", "Class I", "A000001"), senator("CA", "Class III", "B000002", "Appointed")), senateUniverse(), noSenate, { A000001: "2019-01-03", B000002: "2025-02-01" });
    expect(result.errors).toEqual([]);
    expect(result.records.filter(row => row.person).map(row => [row.office.senateClass, row.membership?.serviceStartedAt, row.membership?.termStartsAt])).toEqual([[1, "2019-01-03", "2025-01-03"], [3, "2025-02-01", "2025-02-01"]]);
    expect(parseSenateRoster(senate(senator("CA", "Class I", "A000001")), {}).errors.map(issue => issue.code)).toContain("MISSING_SERVICE_START");
  });

  it("requires the exact 100-seat Senate universe, two classes per state, and no territorial roster rows", () => {
    const invalid = reconcileSenateRoster(senate(senator("PR", "Class I", "P000001")), senateUniverse().slice(0, 99), noSenate, { P000001: "2025-01-03" });
    expect(invalid.errors.map(issue => issue.code)).toEqual(expect.arrayContaining(["UNIVERSE_INCONSISTENCY", "SENATE_CLASS_PAIR", "UNEXPECTED_SENATE_REPRESENTATION"]));
  });

  it("smoke-tests the retained 441-seat House policy universe", () => {
    const result = reconcileHouseRoster(readFileSync(resolve(process.cwd(), "data/source/identity/house-member-data.xml"), "utf8"), houseUniverse());
    expect(houseUniverse()).toHaveLength(441);
    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(441);
    expect(result.records.filter(row => row.person).length).toBe(437);
    expect(result.records.filter(row => !row.person).length).toBe(4);
  });

  it("structurally smoke-tests retained Senate XML with a test-only complete ID map", () => {
    const xml = readFileSync(resolve(process.cwd(), "data/source/identity/senate-members.xml"), "utf8");
    const ids = [...xml.matchAll(/<bioguide_id>\s*([A-Z]\d{6})\s*<\/bioguide_id>/g)].map(match => match[1]!);
    const testOnlyStarts: SenateServiceStartMap = Object.fromEntries(ids.map(id => [id, "2025-01-03"]));
    const result = parseSenateRoster(xml, testOnlyStarts);
    expect(new Set(ids).size).toBe(100);
    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(100);
  });
});
