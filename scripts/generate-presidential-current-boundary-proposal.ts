import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parsePresidentialDistricts } from "./enrich-full-factual";
import { buildPresidentialCurrentBoundaryProposal, validatePresidentialCurrentBoundaryProposal } from "../src/ingestion/elections/presidential-current-boundary-proposal";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const voting = new Set(["AS", "DC", "GU", "MP", "PR", "VI"]);
type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string };

async function locked(entry: Entry): Promise<Buffer> {
  if (entry.retainedStatus !== "retained" || !entry.retainedPath) throw new Error(`PRESIDENTIAL_2020_SOURCE_NOT_RETAINED:${entry.id}`);
  const bytes = await readFile(resolve(entry.retainedPath));
  if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`PRESIDENTIAL_2020_SOURCE_LOCK_MISMATCH:${entry.id}`);
  return bytes;
}

async function writeExact(path: string, bytes: Buffer): Promise<void> {
  try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error("PRESIDENTIAL_2020_PROPOSAL_OUTPUT_CONFLICT"); }
}

async function main(): Promise<void> {
  const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Entry[] };
  const byId = new Map(sourceLock.entries.map((entry) => [entry.id, entry]));
  const rawEntry = byId.get("downballot-presidential-cd-2024-csv"), geometryEntry = byId.get("geo-national-cd119"), projectionEntry = byId.get("dsa-target-factual-projection-20260804-v1");
  if (!rawEntry || !geometryEntry || !projectionEntry) throw new Error("PRESIDENTIAL_2020_SOURCE_LOCK_ENTRY_MISSING");
  const [raw, geometryBytes, projectionBytes] = await Promise.all([locked(rawEntry), locked(geometryEntry), locked(projectionEntry)]);
  const geometry = JSON.parse(geometryBytes.toString("utf8")) as { features?: { properties?: { stateCode?: string; districtCode?: string; cdSession?: string } }[] };
  const geometryKeys = (geometry.features ?? []).filter((feature) => feature.properties?.stateCode && feature.properties.districtCode && feature.properties.cdSession === "119" && !voting.has(feature.properties.stateCode)).map((feature) => `${feature.properties!.stateCode}-${feature.properties!.districtCode}`);
  const proposal = buildPresidentialCurrentBoundaryProposal({ districts: parsePresidentialDistricts(raw.toString("utf8")), projection: JSON.parse(projectionBytes.toString("utf8")), geometryKeys, geometryFileSha256: geometryEntry.sha256 });
  validatePresidentialCurrentBoundaryProposal(proposal);
  const output = resolve("data/metadata/presidential-current-boundary-review-proposal-20260804-v1.json");
  await writeExact(output, Buffer.from(`${JSON.stringify(proposal, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...proposal.summary, packageSha256: proposal.packageSha256 }, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "PRESIDENTIAL_2020_PROPOSAL_GENERATION_FAILED"}\n`); process.exitCode = 1; });
