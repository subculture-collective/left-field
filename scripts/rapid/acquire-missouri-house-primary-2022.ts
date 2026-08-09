import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const pdf = {
  url: "https://web.archive.org/web/20250826141506id_/https://www.sos.mo.gov/CMSImages/ElectionResultsStatistics/ActualResults-August22022.pdf",
  path: "data/source/rapid/house-primary/mo/2022/primary-results.pdf",
  bytes: 1_283_832,
  sha256: "9d62384135197ee0722eb5be00ac4c2b4eb05a05b65b04c9723298a26b06db06",
} as const;
const text = {
  path: "data/source/rapid/house-primary/mo/2022/primary-results-layout.txt",
  bytes: 228_460,
  sha256: "fc7bf0c8dbb53609eff74250310f9bf5bf13d36eb309ddd8c00d5b02ee51dee5",
} as const;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  let pdfBytes: Buffer;
  try {
    pdfBytes = await readFile(pdf.path);
    if (pdfBytes.length !== pdf.bytes || sha(pdfBytes) !== pdf.sha256) throw new Error("MISSOURI_2022_PDF_CONFLICT");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const response = await fetch(pdf.url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`MISSOURI_2022_FETCH_FAILED:${response.status}`);
    pdfBytes = Buffer.from(await response.arrayBuffer());
    if (pdfBytes.length !== pdf.bytes || sha(pdfBytes) !== pdf.sha256) throw new Error("MISSOURI_2022_PDF_DRIFT");
    await mkdir(dirname(pdf.path), { recursive: true });
    await writeFile(pdf.path, pdfBytes, { flag: "wx" });
  }
  try {
    const prior = await readFile(text.path);
    if (prior.length !== text.bytes || sha(prior) !== text.sha256) throw new Error("MISSOURI_2022_TEXT_CONFLICT");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${text.path}.tmp-${process.pid}`;
  execFileSync("pdftotext", ["-layout", pdf.path, temporary]);
  const textBytes = await readFile(temporary);
  try {
    if (textBytes.length !== text.bytes || sha(textBytes) !== text.sha256) throw new Error("MISSOURI_2022_TEXT_DRIFT");
    await rename(temporary, text.path);
  } finally {
    await rm(temporary, { force: true });
  }
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "MISSOURI_2022_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
