import { describe, expect, it } from "vitest";
import { assessEvaluationEligibility, evaluationProgramSchema, governingBodyDefinitionSchema, jurisdictionDefinitionSchema, publicOfficeDefinitionSchema } from "./office-universe";
import { DSA_HOUSE_EVALUATION_PROGRAM } from "./dsa-target-evaluator";

const source = [{ sourceId: "source_official", snapshotId: "snapshot_official", authority: "official" }] as const;
const house = { id: "office_us_house_ny_01", catalogScope: "federal_congressional", jurisdictionId: "jurisdiction_us", governingBodyId: "body_us_house", governmentLevel: "federal", officeFamily: "legislative", title: "U.S. Representative", sourceTitle: "Representative in Congress", selectionMethod: "elected", electionMethod: "partisan_primary_general", partisan: true, districtMagnitude: 1, seatCount: 1, termLengthMonths: 24, geographicScopeId: "geo_us_house_ny_01", sourceNaturalKey: "US-H-NY-01", effectiveFrom: "1789-03-04", effectiveTo: null, sourceReferences: source } as const;
const dsaHouseProgram = { ...DSA_HOUSE_EVALUATION_PROGRAM, requiredFactKeys: ["presidential_margin", "incumbent_finance", "primary_history"] } as const;

describe("all-office universe boundary", () => {
  it("represents local and unusual elected offices without weakening formula eligibility", () => {
    const dogCatcher = publicOfficeDefinitionSchema.parse({ ...house, id: "office_example_dog_catcher", catalogScope: "county_example", jurisdictionId: "jurisdiction_example_county", governingBodyId: null, governmentLevel: "county", officeFamily: "public_safety", title: "Dog Catcher", sourceTitle: "Dog Catcher", electionMethod: "nonpartisan_plurality", partisan: false, termLengthMonths: null, geographicScopeId: "geo_example_county", sourceNaturalKey: "EXAMPLE-DOG-CATCHER", effectiveFrom: null });
    expect(dogCatcher.title).toBe("Dog Catcher");
    expect(assessEvaluationEligibility(dogCatcher, dsaHouseProgram, dsaHouseProgram.requiredFactKeys)).toMatchObject({ status: "ineligible" });
  });

  it("separates formula eligibility from missing factual coverage", () => {
    expect(assessEvaluationEligibility(house, dsaHouseProgram, ["presidential_margin"])).toEqual({ status: "missing_facts", reasons: [], missingFactKeys: ["incumbent_finance", "primary_history"] });
    expect(assessEvaluationEligibility(house, dsaHouseProgram, dsaHouseProgram.requiredFactKeys)).toEqual({ status: "eligible", reasons: [], missingFactKeys: [] });
  });

  it("validates jurisdiction hierarchy and rejects duplicate program declarations", () => {
    expect(jurisdictionDefinitionSchema.parse({ id: "jurisdiction_example_city", parentJurisdictionId: "jurisdiction_example_county", kind: "municipality", name: "Example City", stateCode: "IL", sourceReferences: source }).kind).toBe("municipality");
    expect(governingBodyDefinitionSchema.parse({ id: "body_example_school_board", jurisdictionId: "jurisdiction_example_school", name: "Example School Board", kind: "board", effectiveFrom: null, effectiveTo: null, sourceReferences: source }).kind).toBe("board");
    expect(() => evaluationProgramSchema.parse({ ...dsaHouseProgram, requiredFactKeys: ["primary_history", "primary_history"] })).toThrow("unique");
  });

  it("catalogs appointed or unknown-selection offices but does not treat them as score-eligible elections", () => {
    const appointed = publicOfficeDefinitionSchema.parse({ ...house, selectionMethod: "appointed" });
    expect(assessEvaluationEligibility(appointed, dsaHouseProgram, dsaHouseProgram.requiredFactKeys)).toMatchObject({ status: "ineligible", reasons: ["unsupported selection method: appointed"] });
  });
});
