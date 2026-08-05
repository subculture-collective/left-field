import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildHouseFilingRunwayAuthorityProposal, validateHouseFilingRunwayAuthorityProposal } from "../src/ingestion/elections/house-filing-runway-authority-proposal";

type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string };
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function locked(entry: Entry): Promise<Buffer> { if (entry.retainedStatus !== "retained" || !entry.retainedPath) throw new Error(`FILING_RUNWAY_AUTHORITY_SOURCE_NOT_RETAINED:${entry.id}`); const bytes = await readFile(resolve(entry.retainedPath)); if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`FILING_RUNWAY_AUTHORITY_SOURCE_LOCK_MISMATCH:${entry.id}`); return bytes; }
async function writeExact(path: string, bytes: Buffer): Promise<void> { try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error("FILING_RUNWAY_AUTHORITY_OUTPUT_CONFLICT"); } }

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Entry[] }; const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const projection = byId.get("dsa-target-factual-projection-20260804-v1"), fec = byId.get("fec-2026-congressional-primary-dates");
  if (!projection || projection.kind !== "production_projection_receipt" || !fec || fec.kind !== "source") throw new Error("FILING_RUNWAY_AUTHORITY_SOURCE_LOCK_ENTRY_MISSING");
  const [projectionBytes, fecBytes] = await Promise.all([locked(projection), locked(fec)]);
  const proposal = buildHouseFilingRunwayAuthorityProposal({ projection: JSON.parse(projectionBytes.toString("utf8")), projectionFileSha256: projection.sha256, fecDiscoveryFileSha256: fec.sha256, fecDiscoveryByteSize: fecBytes.byteLength });
  validateHouseFilingRunwayAuthorityProposal(proposal);
  const output = resolve("data/metadata/house-filing-runway-authority-proposal-20260804-v1.json"); await writeExact(output, Buffer.from(`${JSON.stringify(proposal, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...proposal.summary, packageSha256: proposal.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "FILING_RUNWAY_AUTHORITY_GENERATION_FAILED"}\n`); process.exitCode = 1; });
