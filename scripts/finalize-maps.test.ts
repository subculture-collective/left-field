import { describe, expect, it } from "vitest";

import { parseFinalizeMapsArguments } from "./finalize-maps";
import { equalBytes } from "@/ingestion/tiger/finalize-maps";

describe("finalize:maps arguments", () => {
  it("accepts only the bound source and candidate release arguments", () => {
    expect(parseFinalizeMapsArguments(["--candidate-release", "rel_candidate_1", "--source-release", "rel_published_1"])).toEqual({ candidateRelease: "rel_candidate_1", sourceRelease: "rel_published_1" });
  });

  it("rejects arbitrary object keys, duplicates, and invalid branches", () => {
    for (const argv of [[], ["--candidate-release", "rel_candidate_1", "--source-release", "rel_candidate_1"], ["--candidate-release", "rel_candidate_1", "--source-release", "rel_published_1", "--key", "anything"], ["--candidate-release", "rel_candidate_1", "--candidate-release", "rel_candidate_2", "--source-release", "rel_published_1"]]) expect(() => parseFinalizeMapsArguments(argv)).toThrow("Require exactly");
  });
});

describe("map finalization byte evidence", () => {
  it("rejects a one-byte store mismatch rather than JSON serializing Uint8Arrays", () => {
    expect(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]))).toBe(false);
    expect(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });
});
