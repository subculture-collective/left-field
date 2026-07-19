import { describe, expect, it } from "vitest";
import { GENERAL_COMPONENTS, PRIMARY_COMPONENTS, evaluateFixture, parseScoringFixture } from "./scoring-exploration";
import { scoringFixtureCatalog } from "./scoring-fixtures";

describe("fixture-bound scoring exploration", () => {
  it("uses exact PRD components and evaluates complete primary and general fixtures without ranks", () => {
    expect(PRIMARY_COMPONENTS).toHaveLength(5); expect(GENERAL_COMPONENTS).toHaveLength(4);
    expect(evaluateFixture("complete_primary")).toEqual({ exploration: "primary", status: "illustrative_composite", composite: 66 });
    expect(evaluateFixture("complete_general")).toEqual({ exploration: "general", status: "illustrative_composite", composite: 68.25 });
    expect(evaluateFixture("complete_primary")).not.toHaveProperty("rank");
  });
  it("keeps missing and explicitly ineligible catalog entries unranked", () => {
    expect(evaluateFixture("missing_primary")).toMatchObject({ exploration: "primary", status: "unranked", reason: "missing_components" });
    expect(evaluateFixture("missing_general")).toMatchObject({ exploration: "general", status: "unranked", reason: "missing_components" });
    (["ineligible_open", "ineligible_vacant", "ineligible_delegate", "ineligible_special"] as const).forEach((id) => expect(evaluateFixture(id)).toMatchObject({ status: "unranked", reason: "ineligible" }));
  });
  it("validates real dates, future observations, strict shape, and immutable catalog records", () => {
    expect(() => parseScoringFixture({ ...scoringFixtureCatalog.complete_primary, metadata: { ...scoringFixtureCatalog.complete_primary.metadata, sourceCutoff: "2026-02-30" } })).toThrow();
    expect(() => parseScoringFixture({ ...scoringFixtureCatalog.complete_primary, components: [{ ...scoringFixtureCatalog.complete_primary.components[0], sourceObservedAt: "2026-02-01" }, ...scoringFixtureCatalog.complete_primary.components.slice(1)] })).toThrow("Observed date");
    expect(() => parseScoringFixture({ ...scoringFixtureCatalog.complete_primary, rank: 1 })).toThrow();
    expect(Object.isFrozen(scoringFixtureCatalog.complete_primary.components[0])).toBe(true);
    expect(() => { (scoringFixtureCatalog.complete_primary.components[0] as { weight: number }).weight = 0; }).toThrow();
  });
});
