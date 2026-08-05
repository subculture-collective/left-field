import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDsaTargetReviewReportV2, validateDsaTargetReviewReportV2 } from "./dsa-target-review-report-v2";
import { validateDsaTargetFactualProjection, validateDsaTargetReviewReport } from "./dsa-target-review-report";
import { validateDsaTargetIncumbentRoster, validateIncumbentTenureFactualCandidate } from "../ingestion/identity/incumbent-tenure-factual-candidate";

const readBytes = (path: string): Buffer => readFileSync(resolve(path));
const readJson = (path: string): unknown => JSON.parse(readBytes(path).toString("utf8"));
const fileSha = (path: string): string => createHash("sha256").update(readBytes(path)).digest("hex");
const projectionPath = "data/metadata/dsa-target-factual-projection-20260804-v1.json";
const tenurePath = "data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json";
const rosterPath = "data/metadata/dsa-target-incumbent-roster-20260804-v1.json";
const reportPath = "data/metadata/dsa-target-evaluation-review-report-20260804-v2.json";
const projection = validateDsaTargetFactualProjection(readJson(projectionPath));
const tenure = validateIncumbentTenureFactualCandidate(readJson(tenurePath));
const roster = validateDsaTargetIncumbentRoster(readJson(rosterPath));
const checkedIn = validateDsaTargetReviewReportV2(readJson(reportPath));
const v1 = validateDsaTargetReviewReport(readJson("data/metadata/dsa-target-evaluation-review-report-20260804-v1.json"));
const excludedProposalPackages = v1.inputClosure.excludedProposalPackages;
const build = (overrides: Record<string, unknown> = {}) => buildDsaTargetReviewReportV2({ projection, projectionFileSha256: fileSha(projectionPath), tenureCandidate: tenure, tenureFileSha256: fileSha(tenurePath), roster, rosterFileSha256: fileSha(rosterPath), excludedProposalPackages, ...overrides });
const lock = readJson("data/source-lock.json") as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] };
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));

describe("DSA target reviewer report v2", () => {
  it("deterministically applies all 212 tenure values under the reviewer-only default", () => {
    const first = build(), second = build();
    expect(second).toEqual(first);
    expect(first).toEqual(checkedIn);
    expect(first.summary).toEqual({ seats: 212, cashValues: 210, cashMissing: 2, tenureCandidateValues: 212, tenureMissing: 0, tenureReviewerDefaultRows: 212, partialQualified: 117, partialNotQualified: 95, aipacNumericEvidenceRows: 0, aipacRouteSelections: 0 });
    const facts = new Map(tenure.facts.map((fact) => [fact.seatCycleId, fact]));
    expect(first.seats.every((seat) => {
      const fact = facts.get(seat.seatCycleId);
      return fact && seat.incumbentTenure.valueYears === fact.selectedEvaluatorValue.value && seat.incumbentTenure.factSha256 === fact.factSha256 && !(seat.missingFactKeys as string[]).includes("incumbent_tenure") && seat.evaluation.components.aipacSupport.score === null;
    })).toBe(true);
    expect(first.seats.filter((seat) => seat.evaluation.components.primaryFeasibility.coverage === 0.4)).toHaveLength(210);
    expect(first.seats.filter((seat) => seat.evaluation.components.primaryFeasibility.coverage === 0.2)).toHaveLength(2);
  });

  it("retains the v1 audit artifact and closes v2 to six exact parents", () => {
    expect(() => validateDsaTargetReviewReport(v1)).not.toThrow();
    expect(v1.schema).toBe("dsa-target-evaluation-review-report-v1");
    expect(checkedIn.reportSha256).not.toBe(v1.reportSha256);
    const entry = byId.get("dsa-target-evaluation-review-report-20260804-v2")!;
    expect(entry).toMatchObject({ retainedPath: reportPath, byteSize: readBytes(reportPath).byteLength, sha256: fileSha(reportPath), kind: "review_proposal" });
    expect(new Set(entry.parentIds)).toEqual(new Set(["dsa-target-factual-projection-20260804-v1", "incumbent-tenure-factual-candidate-20260804-v1", "aipac-candidate-seat-mappings-proposal-v1", "aipac-evidence-closure-proposal-v1", "org-classification-aipac-network-proposal-v1", "aipac-review-decision-queue-v1"]));
  });

  it("rejects candidate governance, roster, universe, and package mutations", () => {
    expect(() => build({ tenureCandidate: { ...tenure, publicationEligible: true } })).toThrow();
    expect(() => build({ tenureCandidate: { ...tenure, decision: { ...tenure.decision, blocksPublication: false } } })).toThrow();
    expect(() => build({ rosterFileSha256: "a".repeat(64) })).toThrow("INPUT_CLOSURE_INVALID");
    expect(() => build({ tenureCandidate: { ...tenure, facts: tenure.facts.slice(1) } })).toThrow();
    expect(() => build({ tenureFileSha256: "not-a-sha" })).toThrow("INPUT_CLOSURE_INVALID");
  });

  it("keeps private/raw tenure fields out and rejects output mutation", () => {
    const serialized = JSON.stringify(checkedIn);
    for (const forbidden of ["bioguideId", "sourceTerms", "firstHouseServiceDate", "currentUninterruptedHouseServiceDate", "materialServiceBreaks"]) expect(serialized).not.toContain(`\"${forbidden}\"`);
    expect(() => validateDsaTargetReviewReportV2({ ...checkedIn, publicationEligible: true })).toThrow();
    expect(() => validateDsaTargetReviewReportV2({ ...checkedIn, summary: { ...checkedIn.summary, aipacRouteSelections: 1 } })).toThrow();
    const rows = structuredClone(checkedIn.seats); rows[0].evaluation.targetScore = 0;
    expect(() => validateDsaTargetReviewReportV2({ ...checkedIn, seats: rows })).toThrow("HASH_MISMATCH");
  });
});
