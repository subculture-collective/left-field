import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const historicalImportDirectory = process.env.TX_PRIMARY_HISTORICAL_IMPORT_DIR;
const sources = [
  { year: 2022, stage: "regular", electionId: 47011, dateLabel: "March 01, 2022", title: "2022 MARCH 1ST DEMOCRATIC PRIMARY", pdfSize: 95358, pdfSha: "690559da1e89f6e58d3064a09955fd4876cdca6819cccb515fbc6e2c1e64e536", textSize: 139240, textSha: "a2600f6b9fb9c2ee3c3c5639ff527613aef918d9f4cf28640dd1f392fbac130f" },
  { year: 2022, stage: "runoff", electionId: 47293, dateLabel: "May 24, 2022", title: "2022 MAY 24TH DEMOCRATIC PRIMARY RUNOFF", pdfSize: 9818, pdfSha: "864c956338f041484771a651ce90d97d68fab1b8918897ddb13cb1997122d51e", textSize: 12270, textSha: "0eda408dec8795981f1261e42e17e1397e141b431d5e0e9ab3b7b397826ffc01" },
  { year: 2024, stage: "regular", electionId: 49665, dateLabel: "March 05, 2024", title: "2024 MARCH 5TH DEMOCRATIC PRIMARY", pdfSize: 116615, pdfSha: "9244ced8aa9e1cc79f9bf46a2fe9776e22cfc1c1fc3b4cf973960a9cab75a677", textSize: 172944, textSha: "f136c124ac14c7194e43a3fc3b0b7c958f867ceb7e111d43df548564950f17c8" },
  { year: 2024, stage: "runoff", electionId: 50026, dateLabel: "May 28, 2024", title: "2024 MAY 28TH DEMOCRATIC PRIMARY RUNOFF", pdfSize: 6360, pdfSha: "8efd86e163ae3ec464c8ee57ebe99ee8003f0810a3cb8f78e725801301006322", textSize: 7538, textSha: "cd5b6a90ab5dacc6ba36e629b173c3bf8f8551e8c288e9f3aa5dd6ca23312638" },
  { year: 2026, stage: "regular", electionId: 53814, dateLabel: "March 03, 2026", title: "2026 DEMOCRATIC PRIMARY ELECTION", pdfSize: 112958, pdfSha: "368b5aef03ccfd24270b398a36fc06d3c37bff1307d9f746f5aa46cddc351ab5", textSize: 163986, textSha: "f17bdadc49314cd71bb6ff918f5723b05799d5bbf09ab88b1397403dc6a88ed4" },
  { year: 2026, stage: "runoff", electionId: 58314, dateLabel: "May 26, 2026", title: "2026 DEMOCRATIC PRIMARY RUNOFF ELECTION", pdfSize: 9976, pdfSha: "9374a53cdcf6b4cff0ec47ffd7cad987fc2535b5a4882ae4dca0e7082f307486", textSize: 12582, textSha: "f4bab5f5b73caaed2e12c76ed0dea4ceb2a410b40b6b2c14711574f85c134b79" },
].map((source) => {
  const slug = `${source.year}-democratic-primary${source.stage === "runoff" ? "-runoff" : ""}-official-canvass`;
  const legacy = source.year < 2026;
  return { ...source, slug, pdfId: `tx-${slug}-pdf`, textId: `tx-${slug}-text`, url: legacy ? `https://results.texas-election.com/static/data/Reports/${source.electionId}/OfficialCanvassReport.pdf` : `https://goelect.txelections.civixapps.com/api-ivis-system/api/s3/enr/electionReports/${source.electionId}/OfficialCanvassReport/pdf`, pdfPath: `data/source/elections/primary-results/texas/${source.year}/${source.stage}/official-canvass-report.pdf`, textPath: `data/source/elections/primary-results/texas/${source.year}/${source.stage}/official-canvass-report.txt`, legacy };
});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
const version = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
if (version.status !== 0 || !`${version.stdout}${version.stderr}`.includes("pdftotext version 26.07.0")) throw new Error("TX_PRIMARY_PDFTOTEXT_VERSION_INVALID");
async function writeExact(path, bytes, code) { const output = resolve(path); await mkdir(dirname(output), { recursive: true }); try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`${code}_OUTPUT_CONFLICT`); } }
for (const source of sources) {
  const pdfEntry = byId.get(source.pdfId), textEntry = byId.get(source.textId);
  if (!pdfEntry || pdfEntry.url !== source.url || pdfEntry.retainedPath !== source.pdfPath || pdfEntry.retainedStatus !== "retained" || pdfEntry.byteSize !== source.pdfSize || pdfEntry.sha256 !== source.pdfSha || pdfEntry.kind !== "source" || pdfEntry.parentIds.length !== 0) throw new Error(`TX_PRIMARY_PDF_LOCK_ENTRY_INVALID:${source.slug}`);
  if (!textEntry || textEntry.url !== `urn:dsa-seats:${source.pdfId}:pdftotext-layout` || textEntry.retainedPath !== source.textPath || textEntry.retainedStatus !== "retained" || textEntry.byteSize !== source.textSize || textEntry.sha256 !== source.textSha || textEntry.kind !== "derived_extract" || JSON.stringify(textEntry.parentIds) !== JSON.stringify([source.pdfId])) throw new Error(`TX_PRIMARY_TEXT_LOCK_ENTRY_INVALID:${source.slug}`);
  let pdf;
  if (source.legacy) {
    if (!historicalImportDirectory) throw new Error("TX_PRIMARY_HISTORICAL_IMPORT_DIR_REQUIRED: the official historical host challenges non-browser clients; provide a directory containing the four hash-pinned PDF filenames");
    pdf = await readFile(resolve(historicalImportDirectory, `tx-${source.slug}.pdf`));
  } else {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000), headers: { accept: "application/json", "user-agent": "dsa-seats-source-lock/1.0" } });
    if (!response.ok) throw new Error(`TX_PRIMARY_FETCH_FAILED:${source.slug}:${response.status}`);
    const payload = await response.json(); if (typeof payload.upload !== "string") throw new Error(`TX_PRIMARY_API_PAYLOAD_INVALID:${source.slug}`); pdf = Buffer.from(payload.upload, "base64");
  }
  if (pdf.byteLength !== source.pdfSize || sha(pdf) !== source.pdfSha || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error(`TX_PRIMARY_PDF_SOURCE_DRIFT:${source.slug}`);
  const temporary = await mkdtemp(join(tmpdir(), `dsa-seats-tx-${source.slug}-`));
  try {
    const temporaryPdf = join(temporary, basename(source.pdfPath)), temporaryText = join(temporary, "source.txt"); await writeFile(temporaryPdf, pdf, { flag: "wx", mode: 0o600 }); execFileSync("pdftotext", ["-layout", temporaryPdf, temporaryText], { stdio: "pipe" }); const text = await readFile(temporaryText);
    if (text.byteLength !== source.textSize || sha(text) !== source.textSha || !text.includes(Buffer.from("Texas Secretary of State")) || !text.includes(Buffer.from("Official Canvass Report")) || !text.includes(Buffer.from(source.title)) || !text.includes(Buffer.from(source.dateLabel))) throw new Error(`TX_PRIMARY_TEXT_EXTRACT_DRIFT:${source.slug}`);
    await writeExact(source.pdfPath, pdf, `TX_PRIMARY_${source.slug}_PDF`); await writeExact(source.textPath, text, `TX_PRIMARY_${source.slug}_TEXT`);
    process.stdout.write(`${JSON.stringify({ year: source.year, stage: source.stage, acquisition: source.legacy ? "validated_hash_pinned_historical_import" : "direct_official_api_base64", pdf: { output: resolve(source.pdfPath), byteSize: pdf.byteLength, sha256: sha(pdf) }, text: { output: resolve(source.textPath), byteSize: text.byteLength, sha256: sha(text), tool: "pdftotext", toolVersion: "26.07.0", layoutMode: true } })}\n`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
