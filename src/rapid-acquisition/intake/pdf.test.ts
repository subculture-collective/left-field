import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertPdfHeader, extractPdfText, pdftotextAvailable } from "./pdf";

const KY_PDF = "data/source/rapid/house-primary/ky/2024/primary-results.pdf";

describe("PDF extract retention", () => {
  it("rejects non-PDF bytes before spawning anything", () => {
    expect(() => assertPdfHeader(Buffer.from("hello"))).toThrow("PDF_HEADER_INVALID");
    expect(() => assertPdfHeader(readFileSync(KY_PDF))).not.toThrow();
  });

  it.skipIf(!pdftotextAvailable())("reproduces the retained layout extract for the Kentucky 2024 results", () => {
    const extracted = extractPdfText(KY_PDF, "layout").toString("utf8");
    expect(extracted).toMatch(/Commonwealth of Kentucky\s+Michael G\. Adams, Secretary of State\s+2024 Primary Election Results/);
    const retained = readFileSync("data/source/rapid/house-primary/ky/2024/primary-results-layout.txt", "utf8");
    expect(extracted.slice(0, 200)).toBe(retained.slice(0, 200));
  });

  it.skipIf(!pdftotextAvailable())("produces coordinate TSV with the expected header", () => {
    const tsv = extractPdfText(KY_PDF, "tsv").toString("utf8");
    expect(tsv.split("\n")[0]).toBe("level\tpage_num\tpar_num\tblock_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext");
  });
});
