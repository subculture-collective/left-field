import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const catalogPath = resolve("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json");
const catalogBytes = readFileSync(catalogPath);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (sha(catalogBytes) !== "746dba8bf3f7f4e47e776a47d63f876be496f6faa0e7101e31b0a68a5da410ca") throw new Error("CT_FINAL_PRIMARY_BALLOT_AUDIT_CATALOG_DRIFT");
const catalog = JSON.parse(catalogBytes.toString("utf8"));
if (catalog.documents.length !== 196 || catalog.documents.filter((source) => source.reviewMethod === "pdftotext_layout_review").length !== 193 || catalog.documents.filter((source) => source.reviewMethod === "ocr_visual_review").length !== 3) throw new Error("CT_FINAL_PRIMARY_BALLOT_AUDIT_UNIVERSE_INVALID");

if (process.env.DSA_SEATS_CT_FINAL_PRIMARY_BALLOT_AUDIT_DESCRIBE === "1") {
  process.stdout.write(`${JSON.stringify({ documents: 196, directTextDocuments: 193, ocrDocuments: 3, expectedCongressTokenOccurrences: 1, expectedHouseOfficeRows: 0 })}\n`);
  process.exit(0);
}

const houseOffice = /representative\s+in\s+congress|united\s+states\s+representative|u\.?s\.?\s+representative/i;
const privacyLabel = /residential address|home address|street address|mailing address|address:/i;
let congressTokenOccurrences = 0;
let reviewedPages = 0;
const ocrWork = mkdtempSync(join(tmpdir(), "dsa-seats-ct-ballot-ocr-"));
try {
  for (const source of catalog.documents) {
    const path = resolve(source.retainedPath);
    const bytes = readFileSync(path);
    if (bytes.length !== source.byteSize || sha(bytes) !== source.sha256 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_SOURCE_DRIFT:${source.sourceLockId}`);
    reviewedPages += source.pageCount;
    let text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (source.reviewMethod === "pdftotext_layout_review" && text.trim().length < 200) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_TEXT_MISSING:${source.sourceLockId}`);
    if (source.reviewMethod === "ocr_visual_review") {
      if (text.trim().length >= 200) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_METHOD_DRIFT:${source.sourceLockId}`);
      const prefix = join(ocrWork, source.sourceLockId);
      execFileSync("pdftoppm", ["-png", "-r", "200", path, prefix], { stdio: "ignore" });
      const images = readdirSync(ocrWork).filter((name) => name.startsWith(`${source.sourceLockId}-`) && name.endsWith(".png")).sort();
      if (images.length !== source.pageCount) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_OCR_PAGE_DRIFT:${source.sourceLockId}`);
      text = images.map((name) => execFileSync("tesseract", [join(ocrWork, name), "stdout"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })).join("\n");
      if (text.trim().length < 200) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_OCR_MISSING:${source.sourceLockId}`);
    }
    if (houseOffice.test(text)) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_HOUSE_OFFICE_OBSERVED:${source.sourceLockId}`);
    if (privacyLabel.test(text)) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_PRIVACY_FIELD_OBSERVED:${source.sourceLockId}`);
    congressTokenOccurrences += text.match(/congress/gi)?.length ?? 0;
    if (/congress/i.test(text) && (source.sourceLockId !== "ct-2022-democratic-primary-ballot-bloomfield" || !/Congressional\s+District\s+1/i.test(text))) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_CONGRESS_CONTEXT_DRIFT:${source.sourceLockId}`);
  }
} finally {
  rmSync(ocrWork, { recursive: true, force: true });
}
if (congressTokenOccurrences !== 1) throw new Error(`CT_FINAL_PRIMARY_BALLOT_AUDIT_CONGRESS_COUNT_DRIFT:${congressTokenOccurrences}`);
process.stdout.write(`${JSON.stringify({ documents: 196, reviewedPages, directTextDocuments: 193, ocrDocuments: 3, congressTokenOccurrences, houseOfficeRows: 0, personalAddressFieldsObserved: 0 })}\n`);
