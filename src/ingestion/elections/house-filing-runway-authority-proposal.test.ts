import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateHouseFilingRunwayAuthorityProposal } from "./house-filing-runway-authority-proposal";

const proposalPath = "data/metadata/house-filing-runway-authority-proposal-20260804-v1.json";
const sourcePath = "data/source/elections/fec-2026-congressional-primary-dates.pdf";
const bytes = readFileSync(resolve(proposalPath));
const proposal = JSON.parse(bytes.toString("utf8"));
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] };
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
const sha = (path: string): string => createHash("sha256").update(readFileSync(resolve(path))).digest("hex");

describe("House filing-runway source authority proposal", () => {
  it("validates 38 FEC discovery deadlines without promoting any evaluator values", () => {
    const parsed = validateHouseFilingRunwayAuthorityProposal(proposal);
    expect(parsed.summary).toEqual({ states: 38, seats: 212, fecDiscoveryDeadlines: 38, fecDiscoveryZeroDaySeats: 210, fecDiscoveryPositiveDaySeats: 2, stateAuthorityConfirmedSeats: 0, evaluatorNumericValues: 0, missingStateAuthoritySeats: 212, proposedFormulaIncompatibleSeats: 52, pathSpecificReviewSeats: 13, unassessedFormulaSeats: 147, decisions: 4 });
    expect(parsed.seats.every((seat) => seat.evaluatorValue.reason === "state_authority_not_retained" && !seat.scoreEligible)).toBe(true);
    expect(parsed.seats.filter((seat) => seat.fecDiscoveryRunwayDays > 0).map((seat) => seat.seatCycleId)).toEqual(["seat_house_la_02_current", "seat_house_la_06_current"]);
    expect(parsed.states.find((state) => state.stateCode === "OR")).toMatchObject({ fecPrimaryBallotAccessDeadline: "2026-03-10", fecDeadlineSelection: "all_others" });
  });

  it("binds exact source/proposal bytes and two-parent closure", () => {
    const source = byId.get("fec-2026-congressional-primary-dates")!;
    const artifact = byId.get("house-filing-runway-authority-proposal-20260804-v1")!;
    expect(source).toMatchObject({ retainedPath: sourcePath, byteSize: readFileSync(resolve(sourcePath)).byteLength, sha256: sha(sourcePath), kind: "source", parentIds: [] });
    expect(artifact).toMatchObject({ retainedPath: proposalPath, byteSize: bytes.byteLength, sha256: sha(proposalPath), kind: "review_proposal" });
    expect(new Set(artifact.parentIds)).toEqual(new Set(["fec-2026-congressional-primary-dates", "dsa-target-factual-projection-20260804-v1"]));
  });

  it("rejects publication, numeric promotion, and row mutation", () => {
    expect(() => validateHouseFilingRunwayAuthorityProposal({ ...proposal, publicationEligible: true })).toThrow();
    const seats = structuredClone(proposal.seats); seats[0].scoreEligible = true;
    expect(() => validateHouseFilingRunwayAuthorityProposal({ ...proposal, seats })).toThrow();
    const states = structuredClone(proposal.states); states[0].fecPrimaryBallotAccessDeadline = "2026-08-05";
    expect(() => validateHouseFilingRunwayAuthorityProposal({ ...proposal, states })).toThrow();
  });
});
