import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCaliforniaCurrentIncumbentPrimaryLinkageCandidate } from "../src/ingestion/elections/california-current-incumbent-primary-linkage-candidate";

const load = async (path: string) => { const bytes = await readFile(resolve(path)); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const text = async (path: string) => { const bytes = await readFile(resolve(path)); return { value: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex") }; };
async function main(): Promise<void> {
  const roster = await load("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), clerk = await text("data/source/identity/house-member-data.xml"), congress = await load("data/source/identity/congress-legislators-current-20260804.json"), receipt = await load("data/metadata/california-house-top-two-results-2022-2026-v1.json"), sourceLock = await load("data/source-lock.json");
  const value = buildCaliforniaCurrentIncumbentPrimaryLinkageCandidate({ roster: roster.value, rosterFileSha256: roster.sha256, proposal: proposal.value, proposalFileSha256: proposal.sha256, clerkXml: clerk.value, clerkFileSha256: clerk.sha256, congressCurrent: congress.value, congressCurrentFileSha256: congress.sha256, receipt: receipt.value, receiptFileSha256: receipt.sha256, sourceLock: sourceLock.value });
  const output = resolve("data/metadata/california-current-incumbent-primary-linkage-candidate-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CA_PRIMARY_LINKAGE_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, linkSetSha256: value.linkSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
