import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildFilingRunwayExceptionAuthorityProposal, validateFilingRunwayExceptionAuthorityProposal } from "../src/ingestion/elections/filing-runway-exception-authority-proposal";
type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string };
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function locked(entry: Entry): Promise<Buffer> { if (entry.retainedStatus !== "retained" || !entry.retainedPath) throw new Error(`FILING_EXCEPTION_AUTHORITY_SOURCE_NOT_RETAINED:${entry.id}`); const bytes = await readFile(resolve(entry.retainedPath)); if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`FILING_EXCEPTION_AUTHORITY_SOURCE_LOCK_MISMATCH:${entry.id}`); return bytes; }
async function writeExact(path: string, bytes: Buffer): Promise<void> { try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error("FILING_EXCEPTION_AUTHORITY_OUTPUT_CONFLICT"); } }
async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Entry[] }; const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const ids = ["house-filing-runway-authority-proposal-20260804-v1", "ct-2026-election-calendar", "wa-top-two-candidate-faq"] as const;
  const entries = ids.map((id) => byId.get(id)); if (entries.some((entry) => !entry)) throw new Error("FILING_EXCEPTION_AUTHORITY_SOURCE_LOCK_ENTRY_MISSING");
  const [baselineBytes] = await Promise.all(entries.map((entry) => locked(entry!)));
  const authorities = [
    { sourceLockId: "ct-2026-election-calendar", fileSha256: entries[1]!.sha256, publisher: "Connecticut Secretary of the State", use: "deadline_and_path_authority" },
    { sourceLockId: "wa-top-two-candidate-faq", fileSha256: entries[2]!.sha256, publisher: "Washington Secretary of State", use: "formula_scope_authority" },
  ];
  const proposal = buildFilingRunwayExceptionAuthorityProposal({ baseline: JSON.parse(baselineBytes.toString("utf8")), baselineFileSha256: entries[0]!.sha256, authorities }); validateFilingRunwayExceptionAuthorityProposal(proposal);
  const output = resolve("data/metadata/filing-runway-exception-authority-proposal-20260804-v1.json"); await writeExact(output, Buffer.from(`${JSON.stringify(proposal, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...proposal.summary, packageSha256: proposal.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "FILING_EXCEPTION_AUTHORITY_GENERATION_FAILED"}\n`); process.exitCode = 1; });
