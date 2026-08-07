/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial fixtures */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildIncumbentAlignmentTrackerCandidate,
  validateIncumbentAlignmentTrackerCandidate,
} from "../ingestion/scoring/incumbent-alignment-tracker-candidate";
import {
  buildDsaTargetProvisionalScoreV02,
  validateDsaTargetProvisionalScoreV02,
} from "./dsa-target-provisional-score-v02";
const read = (path: string): Buffer => readFileSync(path),
  json = (path: string): any => JSON.parse(read(path).toString("utf8")),
  sha = (bytes: Buffer): string =>
    createHash("sha256").update(bytes).digest("hex");
const paths = {
  left: "data/source/scoring/incumbent-alignment/congressional-democrat-left-tracker-119th-house.xlsx",
  palestine:
    "data/source/scoring/incumbent-alignment/congressional-democrat-palestine-tracker-119th-house.xlsx",
  projection: "data/metadata/dsa-target-factual-projection-20260804-v1.json",
  alignment:
    "data/metadata/incumbent-alignment-tracker-candidate-20260807-v1.json",
  baseline:
    "data/metadata/dsa-target-evaluation-review-report-20260805-v6.json",
  output: "data/metadata/dsa-target-provisional-score-20260807-v02.json",
} as const;
describe("deadline provisional target score v0.2", () => {
  it("rebuilds the 212 tracker joins and preserves explicit missingness", () => {
    const projectionBytes = read(paths.projection),
      value = buildIncumbentAlignmentTrackerCandidate(
        {
          leftBytes: read(paths.left),
          palestineBytes: read(paths.palestine),
          projection: JSON.parse(projectionBytes.toString("utf8")),
          projectionBytes,
          sourceLock: json("data/source-lock.json"),
        },
        true,
      );
    expect(value).toEqual(
      validateIncumbentAlignmentTrackerCandidate(json(paths.alignment)),
    );
    expect(value.summary).toEqual(
      expect.objectContaining({
        seats: 212,
        leftScores: 212,
        palestineScores: 210,
        partialAlignmentScores: 2,
        exactDistrictJoins: 211,
        identityDistrictRemaps: 1,
        rowsWithAipacLabel: 96,
        rowsWithDmfiLabel: 66,
      }),
    );
    expect(
      value.rows.find((row) => row.seatCycleId === "seat_house_ga_06_current"),
    ).toMatchObject({
      palestineSourceDistrict: "GA-07",
      joinMethod: "identity_supported_historical_district_remap",
    });
    expect(
      value.rows
        .filter((row) => row.palestineScore === null)
        .map((row) => row.seatCycleId)
        .sort(),
    ).toEqual(["seat_house_nj_11_current", "seat_house_tx_18_current"]);
  });
  it("calculates and ranks all 212 seats with a bounded fallback", () => {
    const baselineBytes = read(paths.baseline),
      alignmentBytes = read(paths.alignment),
      value = buildDsaTargetProvisionalScoreV02(
        {
          baseline: JSON.parse(baselineBytes.toString("utf8")),
          baselineFileSha256: sha(baselineBytes),
          alignment: JSON.parse(alignmentBytes.toString("utf8")),
          alignmentFileSha256: sha(alignmentBytes),
          sourceLock: json("data/source-lock.json"),
        },
        true,
      );
    expect(value).toEqual(
      validateDsaTargetProvisionalScoreV02(json(paths.output)),
    );
    expect(value.summary).toEqual(
      expect.objectContaining({
        seats: 212,
        rankedSeats: 212,
        unrankedSeats: 0,
        aipacRouteSeats: 91,
        deepBlueRouteSeats: 121,
        approvals: 1,
        publishedRows: 0,
      }),
    );
    const top = value.rows.find((row) => row.provisionalRank === 1)!;
    expect(top).toMatchObject({
      seatCycleId: "seat_house_ny_16_current",
      incumbentName: "George Latimer",
      provisionalTargetScore: 85,
    });
    expect(
      value.rows.filter(
        (row) => row.baselineScoringMethod === "universal_component_fallback",
      ),
    ).toHaveLength(72);
  });
  it("rejects rehashed score, lifecycle, and missingness fabrication", () => {
    const score: any = json(paths.output);
    score.rows[0].provisionalTargetScore = 100;
    expect(() => validateDsaTargetProvisionalScoreV02(score)).toThrow();
    const lifecycle: any = json(paths.output);
    lifecycle.publicationEligible = false;
    expect(() => validateDsaTargetProvisionalScoreV02(lifecycle)).toThrow();
    const missing: any = json(paths.alignment);
    missing.rows.find(
      (row: any) => row.seatCycleId === "seat_house_nj_11_current",
    ).palestineScore = 0;
    expect(() => validateIncumbentAlignmentTrackerCandidate(missing)).toThrow();
  });
});
