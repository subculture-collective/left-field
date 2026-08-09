import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const source = {
  url: "https://sc.elstats.civera.com/api/download_search.csv?search=%7B%22global%22%3A%7B%22events%22%3A%5B52%5D%7D%2C%22ballotQuestions%22%3A%7B%22text%22%3A%22%22%2C%22types%22%3A%5B%5D%2C%22number%22%3A%22%22%2C%22divisions%22%3A%5B%5D%7D%2C%22contests%22%3A%7B%22candidates%22%3A%5B%5D%2C%22offices%22%3A%5B%7B%22id%22%3A3%7D%5D%2C%22divisions%22%3A%5B%5D%7D%2C%22voterStats%22%3Afalse%2C%22stages%22%3A%5B%5D%2C%22specialElectionsOnly%22%3Afalse%7D",
  path: "data/source/rapid/house-primary/sc/2024/house-primary-event-search.csv",
  bytes: 19_607_419,
  sha256: "fd0a043f0f1fadeecf8a669ca45c3db25ff974704b878caf7ef74da4974bb10d",
} as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  try {
    const bytes = await readFile(source.path);
    if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error("SOUTH_CAROLINA_2024_SOURCE_CONFLICT");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`SOUTH_CAROLINA_2024_FETCH_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error("SOUTH_CAROLINA_2024_SOURCE_DRIFT");
  await mkdir(dirname(source.path), { recursive: true });
  const temporary = `${source.path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, source.path); } finally { await rm(temporary, { force: true }); }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "SOUTH_CAROLINA_2024_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
