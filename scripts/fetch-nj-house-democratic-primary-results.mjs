import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const sources = [
  { year: 2022, pdfSize: 36191, pdfSha: "b45986dd93c57e67c2ce31e5e0d7acd6378ddb9becd7d60befc38601b2a807a8", textSize: 61052, textSha: "4825bfe55e409f3b8ea73a6f84b74ab4686845e7341d39ab407211ad281cc9fd" },
  { year: 2024, pdfSize: 117625, pdfSha: "90f8090d6138db048e3dc43b35a03a4936683e191e7fbe90d52ee26bf11cf485", textSize: 54561, textSha: "c2b739d30c430e1e5aea8ac06dc0ce7998f6b3edef6a541741913254a4970910" },
  { year: 2026, pdfSize: 151010, pdfSha: "63f7a09bf07e463f1967994c4fe8d10a971cce479ef6275cce9852d2a8566a42", textSize: 60756, textSha: "65b240fc094c93530f4a4eafbed2dc995a393ae1649cfb80e6b18720eed7c94a" },
].map((source) => ({
  ...source,
  pdfId: `nj-${source.year}-official-primary-results-us-house-pdf`,
  textId: `nj-${source.year}-official-primary-results-us-house-text`,
  url: `https://www.nj.gov/state/elections/assets/pdf/election-results/${source.year}/${source.year}-official-primary-results-us-house.pdf`,
  pdfPath: `data/source/elections/primary-results/new-jersey/${source.year}/official-primary-results-us-house.pdf`,
  textPath: `data/source/elections/primary-results/new-jersey/${source.year}/official-primary-results-us-house.txt`,
}));

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
const version = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
if (version.status !== 0 || !`${version.stdout}${version.stderr}`.includes("pdftotext version 26.07.0")) throw new Error("NJ_PRIMARY_PDFTOTEXT_VERSION_INVALID");

async function writeExact(path, bytes, code) {
  const output = resolve(path); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`${code}_OUTPUT_CONFLICT`); }
}

for (const source of sources) {
  const pdfEntry = byId.get(source.pdfId), textEntry = byId.get(source.textId);
  if (!pdfEntry || pdfEntry.url !== source.url || pdfEntry.retainedPath !== source.pdfPath || pdfEntry.retainedStatus !== "retained" || pdfEntry.byteSize !== source.pdfSize || pdfEntry.sha256 !== source.pdfSha || pdfEntry.kind !== "source" || pdfEntry.parentIds.length !== 0) throw new Error(`NJ_PRIMARY_PDF_LOCK_ENTRY_INVALID:${source.year}`);
  if (!textEntry || textEntry.url !== `urn:dsa-seats:nj-${source.year}-official-primary-results-us-house:pdftotext-layout` || textEntry.retainedPath !== source.textPath || textEntry.retainedStatus !== "retained" || textEntry.byteSize !== source.textSize || textEntry.sha256 !== source.textSha || textEntry.kind !== "derived_extract" || JSON.stringify(textEntry.parentIds) !== JSON.stringify([source.pdfId])) throw new Error(`NJ_PRIMARY_TEXT_LOCK_ENTRY_INVALID:${source.year}`);
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: "application/pdf", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`NJ_PRIMARY_FETCH_FAILED:${source.year}:${response.status}`);
  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.byteLength !== source.pdfSize || sha(pdf) !== source.pdfSha || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error(`NJ_PRIMARY_PDF_SOURCE_DRIFT:${source.year}`);
  const temporary = await mkdtemp(join(tmpdir(), `dsa-seats-nj-${source.year}-`));
  try {
    const temporaryPdf = join(temporary, "source.pdf"), temporaryText = join(temporary, "source.txt");
    await writeFile(temporaryPdf, pdf, { flag: "wx", mode: 0o600 });
    execFileSync("pdftotext", ["-layout", temporaryPdf, temporaryText], { stdio: "pipe" });
    const text = await readFile(temporaryText);
    if (text.byteLength !== source.textSize || sha(text) !== source.textSha || !text.includes(Buffer.from(`For PRIMARY ELECTION ${source.year === 2022 ? "06/07/2022" : source.year === 2024 ? "06/04/2024" : "06/02/2026"} Election`))) throw new Error(`NJ_PRIMARY_TEXT_EXTRACT_DRIFT:${source.year}`);
    await writeExact(source.pdfPath, pdf, `NJ_PRIMARY_${source.year}_PDF`);
    await writeExact(source.textPath, text, `NJ_PRIMARY_${source.year}_TEXT`);
    process.stdout.write(`${JSON.stringify({ year: source.year, pdf: { output: resolve(source.pdfPath), byteSize: pdf.byteLength, sha256: sha(pdf) }, text: { output: resolve(source.textPath), byteSize: text.byteLength, sha256: sha(text), tool: "pdftotext", toolVersion: "26.07.0", layoutMode: true } })}\n`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
