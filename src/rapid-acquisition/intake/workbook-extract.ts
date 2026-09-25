import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { unzipSync, zipSync } from "fflate";

import { byteCompare } from "../shared";
import { readRetainedSource, type SourceLock } from "./source-lock";

/**
 * Workbook CSV extracts, retained once and pinned.
 *
 * LibreOffice is needed to turn the retained .xls/.xlsx sources into CSV, but
 * it is heavy, environment-sensitive, and not a test-time dependency worth
 * keeping. Like the pdftotext extracts, the conversion runs once through the
 * intake CLI, the CSV bytes are retained beside the workbook with the
 * workbook as parent, and readers verify the pin instead of converting.
 */
const fail = (code: string): never => { throw new Error(`WORKBOOK_EXTRACT_${code}`); };

/** Runs LibreOffice headless once and returns `[name.csv, bytes]` per workbook, sorted by name. */
export function convertWorkbooksToCsv(workbooks: readonly (readonly [name: string, bytes: Uint8Array])[]): [string, Buffer][] {
  const workspace = mkdtempSync(join(tmpdir(), "dsa-seats-workbook-extract-"));
  const inputDir = join(workspace, "in"), outputDir = join(workspace, "out");
  try {
    execFileSync("mkdir", ["-p", inputDir, outputDir]);
    for (const [name, bytes] of workbooks) writeFileSync(join(inputDir, basename(name)), bytes);
    execFileSync("libreoffice", [`-env:UserInstallation=file://${join(workspace, "profile")}`, "--headless", "--convert-to", "csv", "--outdir", outputDir, ...workbooks.map(([name]) => join(inputDir, basename(name)))], { stdio: "ignore" });
    const produced = readdirSync(outputDir).filter((name) => name.endsWith(".csv")).sort(byteCompare);
    if (produced.length !== workbooks.length) fail(`CONVERSION_INCOMPLETE:${produced.length}/${workbooks.length}`);
    return produced.map((name) => [name, readFileSync(join(outputDir, name))]);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
}

/** Converts one retained workbook to CSV bytes. */
export function convertWorkbookToCsv(name: string, bytes: Uint8Array): Buffer {
  return convertWorkbooksToCsv([[name, bytes]])[0]![1];
}

/** Converts every .xls/.xlsx member of a retained zip and returns a deterministic zip of the CSVs. */
export function convertWorkbookZipToCsvZip(bytes: Uint8Array): Buffer {
  const members = Object.entries(unzipSync(bytes)).filter(([name]) => /\.xlsx?$/i.test(name)).sort(([left], [right]) => byteCompare(basename(left), basename(right)));
  const csvs = convertWorkbooksToCsv(members.map(([name, content]) => [basename(name), content] as const));
  return Buffer.from(zipSync(Object.fromEntries(csvs.map(([name, content]) => [name, new Uint8Array(content)])), { level: 6, mtime: new Date(Date.UTC(2020, 0, 1)) }));
}

function retainedExtract(lock: SourceLock, extractId: string, parentId: string, root: string): Buffer {
  const { entry, bytes } = readRetainedSource(lock, extractId, root);
  if (entry.kind !== "derived_extract" || entry.parentIds.length !== 1 || entry.parentIds[0] !== parentId) fail(`LINEAGE_INVALID:${extractId}`);
  return bytes;
}

/** Reads a pinned CSV extract whose parent is the given workbook source id. */
export function readWorkbookCsvExtract(lock: SourceLock, extractId: string, parentId: string, root = process.cwd()): string {
  return retainedExtract(lock, extractId, parentId, root).toString("utf8");
}

/** Reads a pinned zip of CSV extracts keyed by member name, sorted. */
export function readWorkbookCsvZipExtract(lock: SourceLock, extractId: string, parentId: string, root = process.cwd()): [string, string][] {
  const archive = unzipSync(new Uint8Array(retainedExtract(lock, extractId, parentId, root)));
  return Object.entries(archive).filter(([name]) => name.endsWith(".csv")).sort(([left], [right]) => byteCompare(left, right)).map(([name, content]) => [name, Buffer.from(content).toString("utf8")]);
}

export const workbookExtractId = (sourceId: string): string => `${sourceId}-libreoffice-csv`;
