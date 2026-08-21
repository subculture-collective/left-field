import { describe, expect, it } from "vitest";

import {
  formulaEligibilitySchema,
  officeUniverseOfficeSchema,
  jurisdictionSchema,
} from "./office-universe";

const provenance = [{ snapshotId: "snap_phase_b_source", role: "original_publisher" }] as const;
const releaseId = "rel_phase_b";

describe("additive office-universe contract", () => {
  it("preserves source-native office identity and hierarchical jurisdiction", () => {
    expect(
      jurisdictionSchema.parse({
        releaseId,
        provenance,
        id: "jurisdiction_in_marion_township",
        parentJurisdictionId: "jurisdiction_in_marion",
        level: "township",
        kind: "township",
        sourceNaturalKey: "IN:township:marion",
        sourceName: "Marion Township",
        effectiveFrom: null,
        effectiveTo: null,
      }),
    ).toMatchObject({ parentJurisdictionId: "jurisdiction_in_marion" });
    expect(
      officeUniverseOfficeSchema.parse({
        releaseId,
        provenance,
        id: "universe_office_in_township_board_001",
        jurisdictionId: "jurisdiction_in_marion_township",
        governingBodyId: "body_in_marion_township_board",
        catalogScope: "source_defined_local",
        level: "township",
        officeFamily: "township_board_member",
        sourceNaturalKey: "1023:001",
        sourceNativeTitle: "Township Board Member",
        normalizedTitle: "township board member",
        selectionMethod: "elected",
        partisanStatus: "partisan",
        electionMethod: "partisan_primary_general",
        districtMagnitude: 3,
      }),
    ).toMatchObject({ sourceNativeTitle: "Township Board Member" });
  });

  it("fails closed until an explicit formula program has complete factual inputs", () => {
    expect(
      formulaEligibilitySchema.parse({
        releaseId,
        provenance,
        officeId: "universe_office_in_township_board_001",
        formulaProgramId: null,
        status: "ineligible",
        missingInputs: [
          { input: "current_holder_identity", reason: "not_collected" },
          { input: "finance_filings", reason: "source_unavailable" },
        ],
        reasons: ["local_office_formula_not_defined"],
      }).status,
    ).toBe("ineligible");
    expect(() =>
      formulaEligibilitySchema.parse({
        releaseId,
        provenance,
        officeId: "universe_office_in_township_board_001",
        formulaProgramId: "formula_local_primary_v1",
        status: "eligible",
        missingInputs: [
          { input: "current_holder_identity", reason: "not_collected" },
        ],
        reasons: ["incorrect_promotion"],
      }),
    ).toThrow();
  });
});
