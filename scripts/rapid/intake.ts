import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  buildRapidLocalContextCoverageV16,
  COVERAGE_ID,
  COVERAGE_PATH,
  COVERAGE_URL,
  serializeCoverage,
  validateRapidLocalContextCoverageV16,
} from "@/rapid-acquisition/intake/coverage";
import {
  buildIntakePackage,
  intakeArtifactPath,
  intakeArtifactUrl,
  intakeParentIds,
  serializeIntakePackage,
  validateIntakePackage,
  type IntakeSpec,
} from "@/rapid-acquisition/intake/package";
import { findIntakeSpec, registeredArtifacts } from "@/rapid-acquisition/intake/registry";
import { assertPdfHeader, extractPdfText, PDF_EXTRACT_TAG } from "@/rapid-acquisition/intake/pdf";
import { INTAKE_SPECS } from "@/rapid-acquisition/intake/specs";
import { DERIVED_ARTIFACTS, derivedParentIds } from "./derived-artifacts";
import { convertWorkbookToCsv, convertWorkbookZipToCsvZip, workbookExtractId } from "@/rapid-acquisition/intake/workbook-extract";
import {
  derivedArtifactEntry,
  readRetainedSource,
  readSourceLock,
  type SourceLock,
  upsertSourceLockEntry,
  writeSourceLock,
} from "@/rapid-acquisition/intake/source-lock";
import { sha } from "@/rapid-acquisition/shared";

import { retainRapidSource } from "./retain-source";

/**
 * One command for state and local intake, replacing per-state generator
 * scripts and hand-edited source-lock entries.
 *
 *   npm run rapid:intake -- list
 *   npm run rapid:intake -- retain <artifact-id>   download declared sources, pin them in the lock
 *   npm run rapid:intake -- build <artifact-id>    build the artifact, pin it, refresh coverage
 *   npm run rapid:intake -- coverage               rebuild the coverage receipt from the registry
 *   npm run rapid:intake -- check                  rebuild every registered intake artifact and compare
 *   npm run rapid:intake -- pin <id> <path> <kind> [parent,...] [url]   pin a reviewed input or downloaded file in the lock (url defaults to a urn)
 *   npm run rapid:intake -- extract-workbook <sourceId> <outputPath>       convert a retained .xls/.xlsx (or a zip of them) to CSV once with LibreOffice and pin the extract
 *   npm run rapid:intake -- derive <artifact-id>   build a registered derived artifact (scores, evidence) and pin it
 *
 * Finish with `npm run data:verify`, which is still the repository gate.
 */

const USAGE = "usage: rapid:intake <list|retain <id>|build <id>|coverage|check|pin <id> <path> <kind> [parents] [url]|derive <id>|extract-workbook <sourceId> <outputPath>>";
const out = (line: string) => process.stdout.write(`${line}\n`);

const specOrFail = (id: string | undefined): IntakeSpec => {
  const spec = id ? findIntakeSpec(id) : undefined;
  if (!spec) throw new Error(`INTAKE_SPEC_UNKNOWN:${id ?? "(missing id)"}\nregistered: ${INTAKE_SPECS.map((entry) => entry.id).join(", ") || "(none)"}`);
  return spec;
};

async function writeArtifact(path: string, bytes: Buffer): Promise<"written" | "unchanged"> {
  try {
    if ((await readFile(path)).equals(bytes)) return "unchanged";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeFile(path, bytes);
  return "written";
}

async function retain(spec: IntakeSpec): Promise<void> {
  let lock = readSourceLock();
  for (const source of spec.sources) {
    if (!source.download) {
      out(`${source.lockId}: no download descriptor; expecting an existing lock entry`);
      continue;
    }
    const result = await retainRapidSource({
      sourceId: source.lockId,
      url: source.download.url,
      outputPath: source.download.outputPath,
      allowedFinalUrl: source.download.allowedFinalUrl,
      sourceLockBytes: Buffer.from(JSON.stringify(lock)),
    });
    lock = upsertSourceLockEntry(lock, {
      ...result.sourceLockEntryCandidate,
      kind: source.download.kind ?? "source",
      parentIds: source.authorityLockIds ?? [],
    });
    out(`${source.lockId}: ${result.status} ${result.sourceLockEntryCandidate.byteSize} bytes sha256 ${result.sourceLockEntryCandidate.sha256}`);
    const extract = source.download.extract;
    if (extract) {
      const pdfPath = result.sourceLockEntryCandidate.retainedPath;
      assertPdfHeader(readFileSync(pdfPath));
      const extractPath = `${pdfPath.replace(/\.pdf$/i, "")}${extract.mode === "layout" ? "-layout.txt" : "-words.tsv"}`;
      const bytes = extractPdfText(pdfPath, extract.mode);
      const status = await writeArtifact(extractPath, bytes);
      lock = upsertSourceLockEntry(lock, derivedArtifactEntry({ id: extract.lockId, url: `urn:dsa-seats:${PDF_EXTRACT_TAG[extract.mode]}:${source.lockId}`, retainedPath: extractPath, bytes, kind: "derived_extract", parentIds: [source.lockId] }));
      out(`${extract.lockId}: ${status} extract (${PDF_EXTRACT_TAG[extract.mode]}) ${bytes.length} bytes sha256 ${sha(bytes)}`);
    }
  }
  writeSourceLock(lock);
}

async function pin(id: string | undefined, path: string | undefined, kind: string | undefined, parents: string | undefined, url?: string): Promise<void> {
  if (!id || !path || !kind) throw new Error(USAGE);
  const bytes = readFileSync(path);
  const lock = upsertSourceLockEntry(readSourceLock(), derivedArtifactEntry({ id, url: url ?? `urn:dsa-seats:${id.replace(/-v(\d+)$/, ":v$1")}`, retainedPath: path, bytes, kind, parentIds: parents ? parents.split(",").filter(Boolean) : [] }));
  writeSourceLock(lock);
  out(`${id}: pinned ${bytes.length} bytes sha256 ${sha(bytes)} kind ${kind}`);
}

async function extractWorkbook(sourceId: string | undefined, outputPath: string | undefined): Promise<void> {
  if (!sourceId || !outputPath) throw new Error(USAGE);
  const lock = readSourceLock();
  const { entry, bytes } = readRetainedSource(lock, sourceId);
  const extracted = /\.zip$/i.test(entry.retainedPath ?? "") ? convertWorkbookZipToCsvZip(bytes) : convertWorkbookToCsv(entry.retainedPath ?? sourceId, bytes);
  await mkdir(dirname(outputPath), { recursive: true });
  const status = await writeArtifact(outputPath, extracted);
  const id = workbookExtractId(sourceId);
  writeSourceLock(upsertSourceLockEntry(lock, derivedArtifactEntry({ id, url: `urn:dsa-seats:workbook-extract:${sourceId}`, retainedPath: outputPath, bytes: extracted, kind: "derived_extract", parentIds: [sourceId] })));
  out(`${id}: ${status}; ${extracted.length} bytes; sha256 ${sha(extracted)}; parent ${sourceId}`);
}

async function derive(id: string | undefined): Promise<void> {
  const derived = DERIVED_ARTIFACTS.find((entry) => entry.id === id);
  if (!derived) throw new Error(`DERIVED_ARTIFACT_UNKNOWN:${id ?? "(missing id)"}\nregistered: ${DERIVED_ARTIFACTS.map((entry) => entry.id).join(", ")}`);
  const lock = readSourceLock();
  const value = derived.build(process.cwd(), lock);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await mkdir(dirname(derived.path), { recursive: true });
  const status = await writeArtifact(derived.path, bytes);
  writeSourceLock(upsertSourceLockEntry(lock, derivedArtifactEntry({ id: derived.id, url: derived.url, retainedPath: derived.path, bytes, kind: derived.kind, parentIds: [...derivedParentIds(derived, process.cwd(), lock)] })));
  out(`${derived.id}: ${status}; ${bytes.length} bytes; sha256 ${sha(bytes)}`);
  for (const line of derived.describe(value)) out(`  ${line}`);
}

function pinCoverage(lock: SourceLock): SourceLock {
  const coverage = buildRapidLocalContextCoverageV16(process.cwd(), lock);
  const bytes = serializeCoverage(coverage);
  return upsertSourceLockEntry(
    lock,
    derivedArtifactEntry({
      id: COVERAGE_ID,
      url: COVERAGE_URL,
      retainedPath: COVERAGE_PATH,
      bytes,
      kind: "evidence_receipt",
      parentIds: coverage.artifacts.map((artifact) => artifact.id),
    }),
  );
}

async function coverage(lock = readSourceLock()): Promise<void> {
  const value = buildRapidLocalContextCoverageV16(process.cwd(), lock);
  const bytes = serializeCoverage(value);
  const status = await writeArtifact(COVERAGE_PATH, bytes);
  writeSourceLock(pinCoverage(lock));
  out(`${COVERAGE_ID}: ${status}; ${value.artifacts.length} artifacts; ${bytes.length} bytes; sha256 ${sha(bytes)}; package ${value.packageSha256}`);
}

async function build(spec: IntakeSpec): Promise<void> {
  const lock = readSourceLock();
  const value = buildIntakePackage(spec, process.cwd(), lock);
  const bytes = serializeIntakePackage(value);
  const path = intakeArtifactPath(spec);
  const status = await writeArtifact(path, bytes);
  const pinned = upsertSourceLockEntry(
    lock,
    derivedArtifactEntry({
      id: spec.id,
      url: intakeArtifactUrl(spec),
      retainedPath: path,
      bytes,
      kind: "derived_artifact",
      parentIds: intakeParentIds(spec),
    }),
  );
  writeSourceLock(pinned);
  out(`${spec.id}: ${status}; ${bytes.length} bytes; sha256 ${sha(bytes)}`);
  out(`  contest set ${value.contestSetSha256}`);
  out(`  package ${value.packageSha256}`);
  out(`  summary ${JSON.stringify(value.summary)}`);
  for (const cycle of value.cycles)
    out(`  ${cycle.cycleYear} ${cycle.electionDate}: ${cycle.contests} contests, ${cycle.candidateRows} candidate rows, ${cycle.candidateVotes} votes`);
  await coverage(pinned);
}

async function check(): Promise<void> {
  const root = process.cwd();
  for (const artifact of registeredArtifacts()) {
    if (!artifact.spec) continue;
    const value = JSON.parse(await readFile(join(root, artifact.path), "utf8")) as unknown;
    validateIntakePackage(artifact.spec, value, root);
    out(`${artifact.id}: rebuilt and matched`);
  }
  const value = JSON.parse(await readFile(join(root, COVERAGE_PATH), "utf8")) as unknown;
  validateRapidLocalContextCoverageV16(value, root);
  out(`${COVERAGE_ID}: matched`);
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, id] = argv;
  switch (command) {
    case "list":
      for (const artifact of registeredArtifacts())
        out(`${artifact.spec ? "intake" : "legacy"}  ${artifact.id}  ${artifact.label}`);
      return;
    case "retain":
      return retain(specOrFail(id));
    case "build":
      return build(specOrFail(id));
    case "coverage":
      return coverage();
    case "check":
      return check();
    case "pin":
      return pin(id, argv[2], argv[3], argv[4], argv[5]);
    case "derive":
      return derive(id);
    case "extract-workbook":
      return extractWorkbook(id, argv[2]);
    default:
      throw new Error(USAGE);
  }
}

if (require.main === module)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "RAPID_INTAKE_FAILED"}\n`);
    process.exitCode = 1;
  });
