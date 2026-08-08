import { readFile } from "node:fs/promises";

import { housePrimarySourceRegistry } from "@/rapid-acquisition/source-registry";
import { retainRapidSource } from "./retain-source";

export type HousePrimaryAcquisitionAttempt = Readonly<{ stateCode: string; cycleYear: number; sourceId: string; status: "retained" | "already_retained" | "failed"; error: string | null; sourceLockEntryCandidate: unknown | null }>;
export type HousePrimaryAcquisitionReport = Readonly<{ schema: "rapid-house-primary-acquisition-report-v1"; attempts: readonly HousePrimaryAcquisitionAttempt[]; summary: Readonly<{ attempted: number; retained: number; alreadyRetained: number; failed: number }> }>;

export async function acquireHousePrimaryArtifacts(root = process.cwd()): Promise<HousePrimaryAcquisitionReport> {
  const sourceLockBytes = await readFile(`${root}/data/source-lock.json`);
  const ready = housePrimarySourceRegistry().rows.filter((row) => row.acquisitionStatus === "acquisition_ready");
  const attempts: HousePrimaryAcquisitionAttempt[] = [];
  for (const row of ready) for (const artifact of row.artifacts) {
    try {
      const result = await retainRapidSource({
        sourceId: artifact.sourceId,
        url: artifact.url,
        outputPath: artifact.outputPath,
        expectedBytes: artifact.expectedBytes,
        expectedSha256: artifact.expectedSha256,
        allowedFinalUrl: artifact.allowedFinalUrl,
        sourceLockBytes,
      }, { workingDirectory: root });
      attempts.push({ stateCode: row.stateCode, cycleYear: row.cycleYear, sourceId: artifact.sourceId, status: result.status, error: null, sourceLockEntryCandidate: result.sourceLockEntryCandidate });
    } catch (error) {
      attempts.push({ stateCode: row.stateCode, cycleYear: row.cycleYear, sourceId: artifact.sourceId, status: "failed", error: error instanceof Error ? error.message : "RAPID_ACQUISITION_FAILED", sourceLockEntryCandidate: null });
    }
  }
  const sorted = attempts.sort((a, b) => a.stateCode.localeCompare(b.stateCode) || a.cycleYear - b.cycleYear || a.sourceId.localeCompare(b.sourceId));
  return { schema: "rapid-house-primary-acquisition-report-v1", attempts: sorted, summary: { attempted: sorted.length, retained: sorted.filter((row) => row.status === "retained").length, alreadyRetained: sorted.filter((row) => row.status === "already_retained").length, failed: sorted.filter((row) => row.status === "failed").length } };
}

if (require.main === module) acquireHousePrimaryArtifacts().then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)).catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "RAPID_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
