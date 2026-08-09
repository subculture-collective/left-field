import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const pdf = {
  url: "https://elect.ky.gov/Documents/2026%20Primary%20Certification%20of%20Vote%20Totals%20Final.pdf",
  path: "data/source/rapid/house-primary/ky/2026/primary-certification-vote-totals.pdf",
  bytes: 221_811,
  sha256: "e69458bae9bcce14f4aa22b3394ff0d47f9c5c9f8bd2915be1650519fdd8cd9c",
} as const;
const text = {
  path: "data/source/rapid/house-primary/ky/2026/primary-certification-vote-totals-layout.txt",
  bytes: 96_612,
  sha256: "b0fc0f90ac2837238c5bbb8a535c0e0e04a879accd99035852fb4145549c5232",
} as const;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  let pdfBytes: Buffer;
  try {
    pdfBytes = await readFile(pdf.path);
    if (pdfBytes.length !== pdf.bytes || sha(pdfBytes) !== pdf.sha256) throw new Error("KENTUCKY_2026_PDF_CONFLICT");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const response = await fetch(pdf.url, {
      headers: {
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
        referer: "https://elect.ky.gov/results/2020-2029/Pages/2026.aspx",
      },
    });
    if (!response.ok) throw new Error(`KENTUCKY_2026_FETCH_FAILED:${response.status}`);
    pdfBytes = Buffer.from(await response.arrayBuffer());
    if (pdfBytes.length !== pdf.bytes || sha(pdfBytes) !== pdf.sha256) throw new Error("KENTUCKY_2026_PDF_DRIFT");
    await mkdir(dirname(pdf.path), { recursive: true });
    await writeFile(pdf.path, pdfBytes, { flag: "wx" });
  }

  try {
    const prior = await readFile(text.path);
    if (prior.length !== text.bytes || sha(prior) !== text.sha256) throw new Error("KENTUCKY_2026_TEXT_CONFLICT");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${text.path}.tmp-${process.pid}`;
  execFileSync("pdftotext", ["-layout", pdf.path, temporary]);
  const textBytes = await readFile(temporary);
  try {
    if (textBytes.length !== text.bytes || sha(textBytes) !== text.sha256) throw new Error("KENTUCKY_2026_TEXT_DRIFT");
    await rename(temporary, text.path);
  } finally {
    await rm(temporary, { force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "KENTUCKY_2026_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
