import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * PDF text retention for intake sources.
 *
 * The repository does not parse PDFs at runtime. Every retained PDF is paired
 * with a `pdftotext` extract that is itself retained and pinned in the source
 * lock (`kind: "derived_extract"`, parent = the PDF). Specs then parse the
 * extract. This module runs that extraction the same way the legacy modules
 * did by hand, so `rapid:intake retain` can produce both files in one step.
 */
export type PdfExtractMode = "layout" | "tsv";

export const PDF_EXTRACT_TAG: Readonly<Record<PdfExtractMode, string>> = {
  layout: "pdftotext_layout",
  tsv: "pdftotext_tsv_coordinate_columns",
};

const fail = (code: string): never => {
  throw new Error(`PDF_${code}`);
};

export const pdftotextAvailable = (): boolean =>
  ["/usr/bin/pdftotext", "/usr/local/bin/pdftotext", "/opt/homebrew/bin/pdftotext"].some(existsSync);

export const pdftotextVersion = (): string => {
  try {
    return execFileSync("pdftotext", ["-v"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    const text = stderr ? stderr.toString().trim() : "";
    return text || fail("PDFTOTEXT_MISSING");
  }
};

/** Rejects bytes that are not a PDF before anything is spawned. */
export const assertPdfHeader = (bytes: Buffer): void => {
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail("HEADER_INVALID");
};

/** Runs pdftotext over a retained PDF path and returns the extract bytes. */
export function extractPdfText(pdfPath: string, mode: PdfExtractMode): Buffer {
  if (!pdftotextAvailable()) fail("PDFTOTEXT_MISSING");
  const flags = mode === "layout" ? ["-layout"] : ["-tsv"];
  const output = execFileSync("pdftotext", [...flags, pdfPath, "-"], { maxBuffer: 256 * 1024 * 1024 });
  if (!output.length) fail("EXTRACT_EMPTY");
  if (mode === "tsv" && !output.subarray(0, 64).toString("utf8").startsWith("level\tpage_num\tpar_num")) fail("TSV_HEADER_INVALID");
  return output;
}
