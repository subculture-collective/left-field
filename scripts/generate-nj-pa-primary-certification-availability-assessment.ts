import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildNjPaPrimaryCertificationAvailabilityAssessment } from "../src/ingestion/elections/nj-pa-primary-certification-availability-assessment";

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function load(path: string): Promise<{ value: unknown; text: string; sha256: string }> { const bytes = await readFile(resolve(path)); return { value: JSON.parse(bytes.toString("utf8")), text: bytes.toString("utf8"), sha256: sha256(bytes) }; }
async function loadText(path: string): Promise<{ text: string; sha256: string }> { const bytes = await readFile(resolve(path)); return { text: bytes.toString("utf8"), sha256: sha256(bytes) }; }

async function main(): Promise<void> {
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const newJersey = await load("data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json");
  const pennsylvania = await load("data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json");
  const njStatute = await loadText("data/source/elections/primary-results/certification/new-jersey/election-statutes-title-19-chapters-20-29.html");
  const paBoundary = await loadText("data/source/elections/primary-results/certification/pennsylvania/election-data-authority-boundary.html");
  const pa2024 = await loadText("data/source/elections/primary-results/certification/pennsylvania/2024-primary-certification.html");
  const pa2026 = await loadText("data/source/elections/primary-results/certification/pennsylvania/2026-primary-certification.html");
  const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
  const value = buildNjPaPrimaryCertificationAvailabilityAssessment({ proposal: proposal.value, proposalFileSha256: proposal.sha256, newJerseyReceipt: newJersey.value, newJerseyReceiptFileSha256: newJersey.sha256, pennsylvaniaReceipt: pennsylvania.value, pennsylvaniaReceiptFileSha256: pennsylvania.sha256, njStatuteHtml: njStatute.text, njStatuteFileSha256: njStatute.sha256, paBoundaryHtml: paBoundary.text, paBoundaryFileSha256: paBoundary.sha256, pa2024CertificationHtml: pa2024.text, pa2024CertificationFileSha256: pa2024.sha256, pa2026CertificationHtml: pa2026.text, pa2026CertificationFileSha256: pa2026.sha256, sourceLock });
  const output = resolve("data/metadata/nj-pa-primary-certification-availability-assessment-v1.json");
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, rowSetSha256: value.rowSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
