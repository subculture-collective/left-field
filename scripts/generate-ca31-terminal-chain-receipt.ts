import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { buildCa31TerminalChainReceipt, type Ca31TerminalObservation } from "../src/ingestion/fec/ca31-terminal-chain-receipt";

type LockEntry = { id: string; url: string; sha256: string; byteSize: number };
const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const ids = ["openfec-ca31-h8-form2-cutoff-page1", "openfec-ca31-h8-form2-cutoff-page2", "openfec-ca31-h4-form2-cutoff-page1", "openfec-ca31-h4-form2-cutoff-page2", "openfec-ca31-committee-form1-cutoff-page1", "openfec-ca31-committee-form1-cutoff-page2", "fec-form2-ca31-20230912", "fec-form2-1818491", "fec-form1-1724934", "fec-form1-1814721"] as const;

async function acquire(entry: LockEntry, credential: string): Promise<Buffer> {
  const url = new URL(entry.url);
  if (url.hostname === "api.open.fec.gov") url.searchParams.set("api_key", credential);
  const response = await fetch(url, { headers: { accept: url.pathname.endsWith(".pdf") ? "application/pdf" : "application/json" } });
  if (!response.ok) throw new Error(`CA31_TERMINAL_CHAIN_FETCH_FAILED:${entry.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== entry.byteSize || digest(bytes) !== entry.sha256) throw new Error(`CA31_TERMINAL_CHAIN_FETCH_HASH_MISMATCH:${entry.id}`);
  return bytes;
}

type ApiPage = { pagination: { count: number; page: number; pages: number; per_page: number }; results: Array<Record<string, unknown>> };
const parsePage = (bytes: Buffer): ApiPage => JSON.parse(bytes.toString("utf8")) as ApiPage;
const page = (value: ApiPage, terminal: boolean) => ({ count: value.pagination.count, page: value.pagination.page, pages: value.pagination.pages, perPage: value.pagination.per_page as 100, resultCount: value.results.length, terminal });
const textFacts = (bytes: Buffer, required: readonly string[]): string[] => {
  const text = execFileSync("pdftotext", ["-layout", "-", "-"], { input: bytes, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  for (const token of required) if (!text.includes(token)) throw new Error(`CA31_TERMINAL_CHAIN_PDF_FACT_MISSING:${token}`);
  return [...required];
};

async function main(): Promise<void> {
  if (!process.env.FEC_API_CREDENTIAL && existsSync(resolve(".env"))) loadEnvFile(resolve(".env"));
  const credential = process.env.FEC_API_CREDENTIAL;
  if (!credential) throw new Error("FEC_API_CREDENTIAL_REQUIRED");
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: LockEntry[] };
  const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const acquired = new Map<string, Buffer>();
  await Promise.all(ids.map(async (id) => { const entry = byId.get(id); if (!entry) throw new Error(`CA31_TERMINAL_CHAIN_SOURCE_LOCK_MISSING:${id}`); acquired.set(id, await acquire(entry, credential)); }));
  const api = (id: string) => parsePage(acquired.get(id)!);
  const h8p1 = api("openfec-ca31-h8-form2-cutoff-page1"), h8p2 = api("openfec-ca31-h8-form2-cutoff-page2"), h4p1 = api("openfec-ca31-h4-form2-cutoff-page1"), h4p2 = api("openfec-ca31-h4-form2-cutoff-page2"), f1p1 = api("openfec-ca31-committee-form1-cutoff-page1"), f1p2 = api("openfec-ca31-committee-form1-cutoff-page2");
  const record = (rows: Array<Record<string, unknown>>, field: string, expected: unknown) => { const row = rows.find((candidate) => candidate[field] === expected); if (!row) throw new Error(`CA31_TERMINAL_CHAIN_API_RECORD_MISSING:${field}:${String(expected)}`); return row; };
  const f22024 = record(h8p1.results, "election_year", 2024), f22026 = record(h8p1.results, "election_year", 2026), f1initial = record(f1p1.results, "file_number", 1724934), f1terminal = record(f1p1.results, "file_number", 1814721);
  const observed: Ca31TerminalObservation = {
    pagination: { h8Form2Page1: page(h8p1, false), h8Form2Page2: page(h8p2, true), h4Form2Page1: page(h4p1, true), h4Form2Page2: page(h4p2, true), committeeForm1Page1: page(f1p1, false), committeeForm1Page2: page(f1p2, true) },
    form2Election2024: { fileNumber: f22024.file_number as number, receiptDate: f22024.receipt_date as string, electionYear: f22024.election_year as number, amendmentIndicator: f22024.amendment_indicator as string, amendmentVersion: f22024.amendment_version as number, apiCandidateId: f22024.candidate_id as string, pdfUrl: f22024.pdf_url as string },
    form2Election2026: { fileNumber: f22026.file_number as number, receiptDate: f22026.receipt_date as string, electionYear: f22026.election_year as number, amendmentIndicator: f22026.amendment_indicator as string, amendmentVersion: f22026.amendment_version as number, apiCandidateId: f22026.candidate_id as string, pdfUrl: f22026.pdf_url as string, mostRecent: f22026.most_recent as boolean },
    form1Initial: { fileNumber: f1initial.file_number as number, receiptDate: f1initial.receipt_date as string, amendmentIndicator: f1initial.amendment_indicator as string, amendmentVersion: f1initial.amendment_version as number, committeeId: f1initial.committee_id as string, committeeName: f1initial.committee_name as string },
    form1Terminal: { fileNumber: f1terminal.file_number as number, receiptDate: f1terminal.receipt_date as string, amendmentIndicator: f1terminal.amendment_indicator as string, amendmentVersion: f1terminal.amendment_version as number, previousFileNumber: f1terminal.previous_file_number as number, amendmentChain: f1terminal.amendment_chain as number[], committeeId: f1terminal.committee_id as string, committeeName: f1terminal.committee_name as string, mostRecent: f1terminal.most_recent as boolean },
    pdfFacts: {
      form2Election2024: textFacts(acquired.get("fec-form2-ca31-20230912")!, ["H4CA31170", "2024", "House", "CA", "31", "Cisneros for Congress"]),
      form2Election2026: textFacts(acquired.get("fec-form2-1818491")!, ["H4CA31170", "2026", "House", "CA", "31", "Cisneros for Congress"]),
      form1Initial: textFacts(acquired.get("fec-form1-1724934")!, ["C00850420", "Cisneros for Congress", "Cisneros, Gilbert", "DEM", "House", "CA", "31"]),
      form1Terminal: textFacts(acquired.get("fec-form1-1814721")!, ["C00850420", "Cisneros for Congress", "Cisneros, Gilbert", "DEM", "House", "CA", "31"]),
    },
  };
  const value = buildCa31TerminalChainReceipt(lock.entries, observed), output = resolve("data/metadata/ca31-terminal-fec-chain-receipt-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CA31_TERMINAL_CHAIN_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, evidenceSetSha256: value.evidenceSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "CA31_TERMINAL_CHAIN_GENERATION_FAILED"}\n`); process.exitCode = 1; });
