import { describe, expect, it } from "vitest";
import { validEvidenceChain } from "./evidence-fixtures";
import { evidenceRevisionSchema, validateRevisionChain } from "./evidence-schema";

describe("future evidence fixtures", () => {
  it("accepts a fictitious history-preserving corrected chain", () => expect(validateRevisionChain(validEvidenceChain)).toHaveLength(6));
  it("rejects duplicate, broken, skipped, and invalid publication chains", () => {
    expect(() => validateRevisionChain([...validEvidenceChain, { ...validEvidenceChain[5] }])).toThrow("Duplicate");
    expect(() => validateRevisionChain([validEvidenceChain[0], { ...validEvidenceChain[1], predecessorId: "wrong" }])).toThrow("linear");
    expect(() => validateRevisionChain([validEvidenceChain[0], { ...validEvidenceChain[1], status: "published" }])).toThrow("Illegal");
    expect(() => validateRevisionChain([validEvidenceChain[0], validEvidenceChain[1], { ...validEvidenceChain[2], status: "republished" }])).toThrow("Illegal");
  });
  it("allows correction-only content changes and rejects mutations before or after it", () => {
    expect(() => validateRevisionChain([validEvidenceChain[0], { ...validEvidenceChain[1], publisher: "Changed" }])).toThrow("only change");
    expect(() => validateRevisionChain([...validEvidenceChain.slice(0, 4), { ...validEvidenceChain[4], correctionNote: "" }])).toThrow("correction note");
    expect(() => validateRevisionChain([...validEvidenceChain.slice(0, 5), { ...validEvidenceChain[5], publisher: "Changed" }])).toThrow("preserve");
  });
  it("enforces compatible actions, calendar dates, retrieval order, and unique tags", () => {
    expect(() => evidenceRevisionSchema.parse({ ...validEvidenceChain[0], evidenceType: "Congressional Record statement" })).toThrow("incompatible");
    expect(() => evidenceRevisionSchema.parse({ ...validEvidenceChain[0], eventDate: "2026-02-30" })).toThrow();
    expect(() => evidenceRevisionSchema.parse({ ...validEvidenceChain[0], retrievedAt: "2026-01-09" })).toThrow("precedes");
    expect(() => evidenceRevisionSchema.parse({ ...validEvidenceChain[0], topicTags: ["humanitarian_aid", "humanitarian_aid"] })).toThrow("unique");
    expect(() => evidenceRevisionSchema.parse({ ...validEvidenceChain[0], inferredIdeology: "x" })).toThrow();
  });
});
