import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const source = {
  url: "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b05003.dat",
  path: "data/source/rapid/county-demographics/acsdt5y2024-b05003.dat",
  byteSize: 53_827_247,
  sha256: "ba1db3b8c01591b7cfa8d971e8d6b76c8ba53c9e116aacdeb0204c6200d4b7c0",
} as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
async function main() {
  await mkdir(dirname(source.path), { recursive: true });
  try {
    const existing = await readFile(source.path);
    if (existing.length !== source.byteSize || sha(existing) !== source.sha256) throw new Error("COUNTY_CVAP_EXISTING_CONFLICT");
    return;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`COUNTY_CVAP_FETCH_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.byteSize || sha(bytes) !== source.sha256) throw new Error("COUNTY_CVAP_DOWNLOAD_MISMATCH");
  const temporary = `${source.path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, source.path); } finally { await rm(temporary, { force: true }); }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_CVAP_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
