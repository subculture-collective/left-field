import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCurrentIncumbentPrimaryCandidateLinkageCandidate } from "../src/ingestion/elections/current-incumbent-primary-candidate-linkage-candidate";

const loadJson = async (path: string) => { const bytes = await readFile(resolve(path)); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const loadText = async (path: string) => { const bytes = await readFile(resolve(path)); return { value: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex") }; };

async function main(): Promise<void> {
  const roster = await loadJson("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposal = await loadJson("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), clerk = await loadText("data/source/identity/house-member-data.xml"), congressCurrent = await loadJson("data/source/identity/congress-legislators-current-20260804.json"), newJersey = await loadJson("data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json"), pennsylvania = await loadJson("data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json"), sourceLock = await loadJson("data/source-lock.json");
  const value = buildCurrentIncumbentPrimaryCandidateLinkageCandidate({ roster: roster.value, rosterFileSha256: roster.sha256, proposal: proposal.value, proposalFileSha256: proposal.sha256, clerkXml: clerk.value, clerkFileSha256: clerk.sha256, congressCurrent: congressCurrent.value, congressCurrentFileSha256: congressCurrent.sha256, newJersey: newJersey.value, newJerseyFileSha256: newJersey.sha256, pennsylvania: pennsylvania.value, pennsylvaniaFileSha256: pennsylvania.sha256, sourceLock: sourceLock.value });
  const output = resolve("data/metadata/current-incumbent-primary-candidate-linkage-candidate-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("PRIMARY_LINKAGE_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, linkSetSha256: value.linkSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "PRIMARY_LINKAGE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
