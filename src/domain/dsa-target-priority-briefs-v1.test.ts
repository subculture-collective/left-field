/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial fixtures */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildDsaTargetPriorityBriefsV1,
  validateDsaTargetPriorityBriefsV1,
} from "./dsa-target-priority-briefs-v1";
const read = (path: string): Buffer => readFileSync(path),
  json = (path: string): any => JSON.parse(read(path).toString("utf8")),
  sha = (bytes: Buffer): string =>
    createHash("sha256").update(bytes).digest("hex");
const paths = {
  score: "data/metadata/dsa-target-provisional-score-20260807-v02.json",
  tenure: "data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json",
  legislators:
    "data/source/identity/congress-legislators-current-20260804.json",
  projection: "data/metadata/dsa-target-factual-projection-20260804-v1.json",
  output: "data/metadata/dsa-target-priority-briefs-20260807-v1.json",
} as const;
const build = () => {
  const score = read(paths.score),
    tenure = read(paths.tenure),
    legislators = read(paths.legislators),
    projection = read(paths.projection);
  return buildDsaTargetPriorityBriefsV1({
    score: JSON.parse(score.toString("utf8")),
    scoreFileSha256: sha(score),
    tenure: JSON.parse(tenure.toString("utf8")),
    tenureFileSha256: sha(tenure),
    legislators: JSON.parse(legislators.toString("utf8")),
    legislatorsFileSha256: sha(legislators),
    projection: JSON.parse(projection.toString("utf8")),
    projectionFileSha256: sha(projection),
    sourceLock: json("data/source-lock.json"),
  });
};
describe("top-50 target priority briefs", () => {
  it("builds readable, sourced briefs for every scored seat", () => {
    const value = build();
    expect(value.selection).toMatchObject({
      requestedCount: 212,
      emittedCount: 212,
      defaultPublicViewCount: 50,
      rank50Score: 71.4,
      seatsAtOrAbove60: 129,
    });
    expect(value.briefs[0]).toMatchObject({
      rank: 1,
      seatCycleId: "seat_house_ny_16_current",
      officialHouseName: "George Latimer",
      provisionalTargetScore: 85,
      qualifyingRoute: "aipac_supported_blue",
    });
    expect(value.briefs.at(-1)).toMatchObject({
      rank: 212,
      seatCycleId: "seat_house_oh_09_current",
      provisionalTargetScore: 17,
    });
    expect(
      value.briefs.every(
        (row) =>
          row.scoreDrivers.length === 4 &&
          row.scoreSummary.length > 80 &&
          row.personSummary.length > 80 &&
          row.districtSummary.length > 40,
      ),
    ).toBe(true);
  });
  it("reproduces the stored artifact and rejects narrative or lifecycle tampering", () => {
    expect(build()).toEqual(
      validateDsaTargetPriorityBriefsV1(json(paths.output)),
    );
    const narrative = json(paths.output);
    narrative.briefs[0].personSummary = "Made up biography";
    expect(() => validateDsaTargetPriorityBriefsV1(narrative)).toThrow();
    const lifecycle = json(paths.output);
    lifecycle.publicationEligible = false;
    expect(() => validateDsaTargetPriorityBriefsV1(lifecycle)).toThrow();
  });
});
