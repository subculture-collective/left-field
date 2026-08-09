import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SOURCES = [
  { year: 2022, url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20220804ResultsbyPrecinct.xlsx", path: "data/source/rapid/house-primary/tn/2022/primary-results-by-precinct.xlsx", bytes: 5883199, sha256: "e48044d15f8bac515280dae069ef0e7468a07424df6826cd5d62985c312f9849" },
  { year: 2024, url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20240801AllbyPrecinct.xlsx", path: "data/source/rapid/house-primary/tn/2024/primary-results-by-precinct.xlsx", bytes: 1613430, sha256: "3e3589f37aa7680894e711151905dcdbb121b16d32c37414f6e28ddd42090e65" },
] as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  for (const source of SOURCES) {
    const destination = join(process.cwd(), source.path);
    try {
      const existing = await readFile(destination);
      if (existing.length !== source.bytes || sha(existing) !== source.sha256) throw new Error(`TENNESSEE_SOURCE_CONFLICT:${source.year}`);
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`TENNESSEE_FETCH_FAILED:${source.year}:${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`TENNESSEE_SOURCE_DRIFT:${source.year}`);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.tmp-${process.pid}`;
    await writeFile(temporary, bytes, { flag: "wx" });
    try { await rename(temporary, destination); } finally { await rm(temporary, { force: true }); }
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "TENNESSEE_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
