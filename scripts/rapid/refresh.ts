/**
 * Refresh the dated inputs the Senate and state-legislative layers read.
 *
 *   npm run rapid:refresh                 retain today's FEC candidate summary and Open States rosters, pin them, rewrite the refresh pointer
 *   npm run rapid:refresh -- --date 2026-10-01   use an explicit snapshot date for the retained paths and pointer
 *   npm run rapid:refresh -- --skip-download     only re-point at files already retained for the date
 *
 * Downloads are HTTPS only, written under data/source/rapid/, and pinned with
 * their public URL. Nothing is overwritten: a snapshot that already exists for
 * the date is verified against the lock instead of fetched again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { derivedArtifactEntry, findSourceLockEntry, readSourceLock, upsertSourceLockEntry, writeSourceLock, type SourceLock } from "@/rapid-acquisition/intake/source-lock";
import { REFRESH_INPUTS, serializeRefreshInputs, type RefreshInputs } from "@/rapid-acquisition/refresh-inputs";
import { sha } from "@/rapid-acquisition/shared";
import { US_STATE_CODES } from "@/rapid-acquisition/us-states";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const flag = (name: string): boolean => args.includes(`--${name}`);
const today = new Date().toISOString().slice(0, 10);
const date = option("date") ?? today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`REFRESH_DATE_INVALID:${date}`);
const stamp = date.replace(/-/g, "");
const cycle = Number(option("cycle") ?? (new Date(date).getUTCFullYear() + (new Date(date).getUTCFullYear() % 2)));
const out = (line: string) => process.stdout.write(`${line}\n`);

async function download(url: string): Promise<Buffer> {
  if (!url.startsWith("https://")) throw new Error(`REFRESH_URL_NOT_HTTPS:${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`REFRESH_DOWNLOAD_FAILED:${response.status}:${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function retain(lock: SourceLock, id: string, path: string, url: string): Promise<SourceLock> {
  const existing = findSourceLockEntry(lock, id);
  if (existsSync(path)) {
    const bytes = readFileSync(path);
    if (existing && (existing.sha256 !== sha(bytes) || existing.byteSize !== bytes.length)) throw new Error(`REFRESH_EXISTING_MISMATCH:${id}`);
    out(`${id}: already retained (${bytes.length} bytes)`);
    return existing ? lock : upsertSourceLockEntry(lock, derivedArtifactEntry({ id, url, retainedPath: path, bytes, kind: "source", parentIds: [] }));
  }
  if (flag("skip-download")) throw new Error(`REFRESH_MISSING_FOR_DATE:${id}`);
  const bytes = await download(url);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  out(`${id}: retained ${bytes.length} bytes sha256 ${sha(bytes)}`);
  return upsertSourceLockEntry(lock, derivedArtifactEntry({ id, url, retainedPath: path, bytes, kind: "source", parentIds: [] }));
}

async function main(): Promise<void> {
  let lock = readSourceLock();
  const yy = String(cycle).slice(2);
  const fecId = `fec-candidate-summary-${cycle}-${stamp}`;
  lock = await retain(lock, fecId, `data/source/rapid/fec/candidate-summary-${cycle}-${stamp}.zip`, `https://www.fec.gov/files/bulk-downloads/${cycle}/weball${yy}.zip`);
  const rosterIds: string[] = [];
  for (const code of Object.values(US_STATE_CODES).map((value) => value.toLowerCase()).sort()) {
    const id = `openstates-people-${code}-${stamp}`;
    lock = await retain(lock, id, `data/source/rapid/state-legislative-roster/${stamp}/${code}.csv`, `https://data.openstates.org/people/current/${code}.csv`);
    rosterIds.push(id);
  }
  const inputs: RefreshInputs = { schema: "refresh-inputs-v1", version: 1, snapshotDate: date, fecCandidateSummaryId: fecId, fecCandidateSummaryCycle: cycle, stateLegislativeRosterIds: rosterIds };
  const bytes = Buffer.from(serializeRefreshInputs(inputs));
  writeFileSync(REFRESH_INPUTS.path, bytes);
  lock = upsertSourceLockEntry(lock, derivedArtifactEntry({ id: REFRESH_INPUTS.id, url: `urn:dsa-seats:refresh-inputs:v1`, retainedPath: REFRESH_INPUTS.path, bytes, kind: "editorial_ledger", parentIds: [] }));
  writeSourceLock(lock);
  out(`refresh pointer now ${date}: ${fecId}, ${rosterIds.length} rosters. Next: npm run rapid:publish -- --version <vX.Y>`);
}

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exit(1); });
