import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fecV2DecodedEvidenceSha256 } from "./acquisition-coordinator";
import { readFileSync } from "node:fs";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const ledger = "a".repeat(64);

describe("Task7 decoded evidence vectors", () => {
  it("uses the exact page/ledger canonical bytes", () => {
    const bytes = Buffer.from("canonical\n");
    for (const artifactKind of ["enumeration_page", "filing_ledger"] as const) {
      expect(fecV2DecodedEvidenceSha256({ artifactKind } as never, bytes)).toBe(hash("canonical\n"));
    }
  });

  it("freezes the compact sanitized JSON+LF vector and excludes scope fields", () => {
    const artifact = { artifactKind: "sanitized_filing", decoded: { fileNumber: 17, ledgerIdentitySha256: ledger, reportDate: "2026-01-02", candidateIds: ["H1", "H0", "H1"], scopeConclusion: "outside_candidate_targets", semanticSha256: "b".repeat(64) } };
    expect(fecV2DecodedEvidenceSha256(artifact as never, Buffer.from("ignored"))).toBe("6d2bafbe9131d29ef400b257dbf08cde4e898e870177e98360bf0d0a24aa0af6");
  });
  it("only persists the exact source-unavailable acquisition result and treats missing available evidence as catastrophic", () => {
    const source = readFileSync("src/ingestion/fec/acquisition-coordinator.ts", "utf8");
    expect(source).toContain('id.rawAvailability !== "available" ? "source_unavailable"');
    expect(source).toContain('FEC_V2_ACQUISITION_EVIDENCE_INCONSISTENT');
    expect(source).toContain('e.code === "FEC_SANITIZED_ACQUISITION_UNAVAILABLE" && e.processingOutcome === "source_unavailable"');
    expect(source).not.toContain("e.processingOutcome) return x.acquisition.stageAcquisitionOutcome");
  });
  it("replays completed closures through the same graph proof before issuing its reuse attestation", () => {
    const source = readFileSync("src/ingestion/fec/acquisition-coordinator.ts", "utf8");
    const reuse = source.slice(source.indexOf("export async function reuseCompletedFecV2Acquisition"), source.indexOf("const graphKey"));
    expect(reuse).toContain("runId: c.originRunId");
    expect(reuse).toContain("verifyCompletedArtifactGraphParity");
    expect(reuse.indexOf("verifyCompletedArtifactGraphParity")).toBeLessThan(reuse.indexOf("issueCompletedReuseAttestation"));
    expect(reuse).toContain("consumeCompletedReuse");
    expect(reuse).not.toContain("COMPLETED_GRAPH_PARITY_UNAVAILABLE");
  });
});
