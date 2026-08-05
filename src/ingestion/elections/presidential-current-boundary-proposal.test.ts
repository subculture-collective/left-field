import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePresidentialCurrentBoundaryProposal } from "./presidential-current-boundary-proposal";

const bytes = readFileSync(resolve("data/metadata/presidential-current-boundary-review-proposal-20260804-v1.json"));
const proposal = JSON.parse(bytes.toString("utf8"));
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] };
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));

describe("2020 presidential current-boundary review proposal", () => {
  it("validates the checked-in 435-district and 212-target factual candidate", () => {
    const parsed = validatePresidentialCurrentBoundaryProposal(proposal);
    expect(parsed.summary).toEqual({ districtFacts: 435, targetSeatFacts: 212, geometryKeyMatches: 435, production2024Crosschecks: 212, production2024CrosscheckFailures: 0, decisions: 2 });
    expect(parsed.districtFacts.every((row) => row.bidenVotes + row.trumpVotes <= row.totalVotes && row.democraticMarginPoints >= -100 && row.democraticMarginPoints <= 100)).toBe(true);
    expect(parsed.decisions.every((decision) => decision.defaultReversibleAssumption === "exclude_from_scoring_and_publication" && decision.resolution === null)).toBe(true);
  });

  it("binds the checked-in bytes and all three source-lock parents", () => {
    const entry = byId.get("presidential-current-boundary-review-proposal-20260804-v1")!;
    expect(entry).toMatchObject({ retainedPath: "data/metadata/presidential-current-boundary-review-proposal-20260804-v1.json", byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), kind: "review_proposal" });
    expect(new Set(entry.parentIds)).toEqual(new Set(["downballot-presidential-cd-2024-csv", "geo-national-cd119", "dsa-target-factual-projection-20260804-v1"]));
    expect(proposal.source.fileSha256).toBe(byId.get("downballot-presidential-cd-2024-csv")!.sha256);
    expect(proposal.geometry.fileSha256).toBe(byId.get("geo-national-cd119")!.sha256);
  });

  it("rejects mutation and publication", () => {
    expect(() => validatePresidentialCurrentBoundaryProposal({ ...proposal, publicationEligible: true })).toThrow();
    expect(() => validatePresidentialCurrentBoundaryProposal({ ...proposal, sourceCutoff: "2026-08-05" })).toThrow();
    expect(() => validatePresidentialCurrentBoundaryProposal({ ...proposal, districtFacts: proposal.districtFacts.slice(1) })).toThrow();
  });
});
