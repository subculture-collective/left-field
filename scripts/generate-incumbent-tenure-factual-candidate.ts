import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildIncumbentTenureFactualCandidate, validateIncumbentTenureFactualCandidate } from "../src/ingestion/identity/incumbent-tenure-factual-candidate";

type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string };
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function locked(entry: Entry): Promise<Buffer> { if (entry.retainedStatus !== "retained" || !entry.retainedPath) throw new Error(`INCUMBENT_TENURE_SOURCE_NOT_RETAINED:${entry.id}`); const bytes = await readFile(resolve(entry.retainedPath)); if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`INCUMBENT_TENURE_SOURCE_LOCK_MISMATCH:${entry.id}`); return bytes; }
async function writeExact(path: string, bytes: Buffer): Promise<void> { try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error("INCUMBENT_TENURE_OUTPUT_CONFLICT"); } }

async function main(): Promise<void> {
  const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Entry[] }; const byId = new Map(sourceLock.entries.map((entry) => [entry.id, entry]));
  const source = byId.get("congress-legislators-current-20260804"), roster = byId.get("dsa-target-incumbent-roster-20260804-v1");
  if (!source || source.kind !== "source" || !roster || roster.kind !== "production_projection_receipt") throw new Error("INCUMBENT_TENURE_SOURCE_LOCK_ENTRY_MISSING");
  const [sourceBytes, rosterBytes] = await Promise.all([locked(source), locked(roster)]);
  const candidate = buildIncumbentTenureFactualCandidate({ roster: JSON.parse(rosterBytes.toString("utf8")), rosterFileSha256: roster.sha256, legislators: JSON.parse(sourceBytes.toString("utf8")) });
  validateIncumbentTenureFactualCandidate(candidate);
  const output = resolve("data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json"); await writeExact(output, Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...candidate.summary, packageSha256: candidate.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INCUMBENT_TENURE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
