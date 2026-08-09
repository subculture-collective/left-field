import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const headers = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
  referer: "https://scvotes.gov/elections-statistics/election-results/",
} as const;

const sources = [
  { id: "sc-2026-election-results-index", url: "https://scvotes.gov/elections-statistics/election-results/", path: "data/source/rapid/house-primary/sc/2026/election-results-index.html", bytes: 92_673, sha256: "07a501b922471b08e3d8fc6efc77f8833c2560af683c02dde8370ca7f06de6fd", parents: [] },
  { id: "sc-2026-primary-enr-current-version", url: "https://www.enr-scvotes.org/SC/126294/current_ver.txt", path: "data/source/rapid/house-primary/sc/2026/current-version.txt", bytes: 6, sha256: "915d43ab9af60fd2a8527e125f88e295dd9b3abeca79b412bca6886279ad6e7d", parents: ["sc-2026-election-results-index"] },
  { id: "sc-2026-primary-enr-config", url: "https://www.enr-scvotes.org/SC/126294/375593/json/config.json", path: "data/source/rapid/house-primary/sc/2026/config.json", bytes: 82, sha256: "78292ed41040455b998725bdda012ab0b0bd438c27d902795578de956bd7603d", parents: ["sc-2026-primary-enr-current-version"] },
  { id: "sc-2026-primary-enr-election-settings", url: "https://www.enr-scvotes.org/SC/126294/375593/json/en/electionsettings.json", path: "data/source/rapid/house-primary/sc/2026/election-settings.json", bytes: 38_288, sha256: "93589dca72cffcad00a3a863c850180da8885e20d7d1ee9c44015f6a5e9ec81e", parents: ["sc-2026-primary-enr-config"] },
  { id: "sc-2026-primary-enr-summary", url: "https://www.enr-scvotes.org/SC/126294/375593/json/en/summary.json", path: "data/source/rapid/house-primary/sc/2026/summary.json", bytes: 51_532, sha256: "f7e6c57ae8c7eccb002dc0da5fba30b7748b38aee7e36d424feee3d951ee038b", parents: ["sc-2026-primary-enr-election-settings"] },
] as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  for (const source of sources) {
    const response = await fetch(source.url, { headers, redirect: "follow" });
    if (!response.ok) throw new Error(`SOUTH_CAROLINA_2026_DOWNLOAD_FAILED:${source.id}:${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`SOUTH_CAROLINA_2026_SOURCE_DRIFT:${source.id}`);
    await mkdir(dirname(source.path), { recursive: true });
    try { await writeFile(source.path, bytes, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(source.path)).equals(bytes)) throw error; }
    process.stdout.write(`${JSON.stringify({ id: source.id, url: source.url, retainedPath: source.path, retainedStatus: "retained", byteSize: source.bytes, sha256: source.sha256, kind: "source", parentIds: source.parents })}\n`);
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "SOUTH_CAROLINA_2026_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
