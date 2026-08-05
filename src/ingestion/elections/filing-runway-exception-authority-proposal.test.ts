import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFilingRunwayExceptionAuthorityProposal, validateFilingRunwayExceptionAuthorityProposal } from "./filing-runway-exception-authority-proposal";
const path = "data/metadata/filing-runway-exception-authority-proposal-20260804-v1.json";
const bytes = readFileSync(resolve(path)); const proposal = JSON.parse(bytes.toString("utf8"));
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] }; const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
const sha = (file: string): string => createHash("sha256").update(readFileSync(resolve(file))).digest("hex");
describe("filing-runway exception authority proposal", () => {
  it("confirms narrow CT/WA authority without emitting evaluator values", () => {
    const parsed = validateFilingRunwayExceptionAuthorityProposal(proposal);
    expect(parsed.summary).toEqual({ states: 2, seats: 13, deadlineAuthorityConfirmedSeats: 5, formulaScopeConfirmedIncompatibleSeats: 8, pathSpecificReviewSeats: 5, evaluatorNumericValues: 0, decisions: 2 });
    expect(parsed.seats.filter((row) => row.stateCode === "CT")).toHaveLength(5); expect(parsed.seats.filter((row) => row.stateCode === "WA")).toHaveLength(8);
    expect(parsed.seats.every((row) => !row.scoreEligible && row.evaluatorValue.kind === "missing")).toBe(true);
    expect(parsed.states.find((row) => row.stateCode === "CT")).toMatchObject({ confirmedDeadline: "2026-06-09", confirmedDeadlineTime: "16:00 America/New_York", formulaApplicability: "path_specific_review" });
    expect(parsed.states.find((row) => row.stateCode === "WA")).toMatchObject({ confirmedDeadline: null, electionPath: "top_two_non_nominating", formulaApplicability: "confirmed_incompatible" });
  });
  it("binds exact source bytes and three-parent closure", () => {
    for (const [id, file] of [["ct-2026-election-calendar", "data/source/elections/filing-authority/ct-2026-election-calendar.pdf"], ["wa-top-two-candidate-faq", "data/source/elections/filing-authority/wa-top-two-candidate-faq.pdf"]] as const) expect(byId.get(id)).toMatchObject({ retainedPath: file, byteSize: readFileSync(resolve(file)).byteLength, sha256: sha(file), kind: "source", parentIds: [] });
    const entry = byId.get("filing-runway-exception-authority-proposal-20260804-v1")!; expect(entry).toMatchObject({ retainedPath: path, byteSize: bytes.byteLength, sha256: sha(path), kind: "review_proposal" });
    expect(new Set(entry.parentIds)).toEqual(new Set(["house-filing-runway-authority-proposal-20260804-v1", "ct-2026-election-calendar", "wa-top-two-candidate-faq"]));
  });
  it("rejects publication and numeric promotion", () => {
    expect(() => validateFilingRunwayExceptionAuthorityProposal({ ...proposal, publicationEligible: true })).toThrow();
    const seats = structuredClone(proposal.seats); seats[0].scoreEligible = true; expect(() => validateFilingRunwayExceptionAuthorityProposal({ ...proposal, seats })).toThrow();
  });
  it("rejects substituted or role-swapped authority closure", () => {
    const baselineEntry = byId.get("house-filing-runway-authority-proposal-20260804-v1")!;
    const baseline = JSON.parse(readFileSync(resolve(baselineEntry.retainedPath!), "utf8"));
    const substituted = structuredClone(proposal.inputs.authorities); substituted[0].fileSha256 = "0".repeat(64);
    expect(() => buildFilingRunwayExceptionAuthorityProposal({ baseline, baselineFileSha256: baselineEntry.sha256, authorities: substituted })).toThrow();
    const swapped = structuredClone(proposal.inputs.authorities); swapped[0].publisher = "Washington Secretary of State";
    expect(() => buildFilingRunwayExceptionAuthorityProposal({ baseline, baselineFileSha256: baselineEntry.sha256, authorities: swapped })).toThrow();
  });
});
