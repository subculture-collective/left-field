import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDsaTargetReviewReport, validateDsaTargetFactualProjection, validateDsaTargetReviewReport } from "./dsa-target-review-report";

const projectionPath = resolve("data/metadata/dsa-target-factual-projection-20260804-v1.json");
const projectionBytes = readFileSync(projectionPath);
const projection = JSON.parse(projectionBytes.toString("utf8"));
const sourceLock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] };
const locked = new Map(sourceLock.entries.map((entry) => [entry.id, entry]));
const excluded = ["aipac-candidate-seat-mappings-proposal-v1", "aipac-evidence-closure-proposal-v1", "org-classification-aipac-network-proposal-v1", "aipac-review-decision-queue-v1"].map((sourceLockId) => ({ sourceLockId, fileSha256: "a".repeat(64), packageSha256: "b".repeat(64), reviewStatus: "proposed", reason: "unreviewed_proposal_excluded_from_numeric_evaluation" }));
const build = () => buildDsaTargetReviewReport({ projection, projectionFileSha256: createHash("sha256").update(projectionBytes).digest("hex"), excludedProposalPackages: excluded });

describe("DSA target reviewer report", () => {
  it("validates the production-derived 212-seat factual projection", () => {
    const parsed = validateDsaTargetFactualProjection(projection);
    expect(parsed.seats).toHaveLength(212);
    expect(parsed.seats.filter((seat) => seat.incumbentCashOnHand.kind === "value")).toHaveLength(210);
  });

  it("builds a deterministic partial report with a complete proposal firewall", () => {
    const first = build(), second = build();
    expect(second).toEqual(first);
    expect(first.summary.seats).toBe(212);
    expect(first.summary.partialQualified + first.summary.partialNotQualified).toBe(212);
    expect(first.summary).toMatchObject({ cashValues: 210, cashMissing: 2, aipacNumericEvidenceRows: 0, aipacRouteSelections: 0 });
    expect(first.seats.every((seat) => seat.evaluation.components.blueBaseline.coverage === 0.5 && seat.evaluation.components.aipacSupport.score === null && seat.aipac.numericEvidenceUsed === false)).toBe(true);
    expect(first.seats.filter((seat) => seat.missingFactKeys.includes("incumbent_cash_on_hand"))).toHaveLength(2);
    expect(first.seats.filter((seat) => seat.reviewRank !== null).map((seat) => seat.reviewRank).sort((a, b) => a! - b!)).toEqual(Array.from({ length: first.summary.partialQualified }, (_, index) => index + 1));
    expect(first.sensitivity.kind).toBe("formula_only_synthetic");
    expect(first.sensitivity.cases[1]!.targetScore).toBeGreaterThan(first.sensitivity.cases[0]!.targetScore);
    expect(() => validateDsaTargetReviewReport(first)).not.toThrow();
  });

  it("validates the checked-in report against its real source-lock closure", () => {
    const path = resolve("data/metadata/dsa-target-evaluation-review-report-20260804-v1.json");
    const bytes = readFileSync(path); const report = validateDsaTargetReviewReport(JSON.parse(bytes.toString("utf8")));
    const entry = locked.get("dsa-target-evaluation-review-report-20260804-v1")!;
    expect(entry).toMatchObject({ retainedPath: "data/metadata/dsa-target-evaluation-review-report-20260804-v1.json", byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), kind: "review_proposal" });
    expect(new Set(entry.parentIds)).toEqual(new Set(["dsa-target-factual-projection-20260804-v1", ...report.inputClosure.excludedProposalPackages.map((row) => row.sourceLockId)]));
    expect(report.inputClosure.projectionFileSha256).toBe(locked.get("dsa-target-factual-projection-20260804-v1")!.sha256);
    for (const excluded of report.inputClosure.excludedProposalPackages) {
      const proposalEntry = locked.get(excluded.sourceLockId)!;
      const proposal = JSON.parse(readFileSync(resolve(proposalEntry.retainedPath!), "utf8")) as { packageSha256: string };
      expect(excluded).toMatchObject({ fileSha256: proposalEntry.sha256, packageSha256: proposal.packageSha256, reviewStatus: "proposed" });
    }
    expect(report.summary).toMatchObject({ aipacNumericEvidenceRows: 0, aipacRouteSelections: 0 });
  });

  it("rejects projection and report mutation", () => {
    expect(() => validateDsaTargetFactualProjection({ ...projection, generatedAt: "2026-08-05T00:00:00.000Z" })).toThrow("HASH_MISMATCH");
    const report = build();
    expect(() => validateDsaTargetReviewReport({ ...report, publicationEligible: true })).toThrow();
    expect(() => validateDsaTargetReviewReport({ ...report, summary: { ...report.summary, aipacRouteSelections: 1 } })).toThrow();
  });
});
