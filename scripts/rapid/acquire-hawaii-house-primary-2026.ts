import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SOURCE = {
  url: "https://elections.hawaii.gov/wp-content/results/2026%20Primary/summary.txt",
  path: "data/source/rapid/house-primary/hi/2026/summary.txt",
  bytes: 31_544,
  sha256: "d21d1c0e7932cc105c78a3949bbc3387222d8193d37cc8f4faba16e57746e100",
} as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const destination = join(process.cwd(), SOURCE.path);
  try {
    const existing = await readFile(destination);
    if (existing.length !== SOURCE.bytes || sha(existing) !== SOURCE.sha256) throw new Error("HAWAII_2026_SOURCE_CONFLICT");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const response = await fetch(SOURCE.url, { headers: { accept: "text/plain", "user-agent": "curl/8.16.0" } });
  if (!response.ok) throw new Error(`HAWAII_2026_FETCH_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== SOURCE.bytes || sha(bytes) !== SOURCE.sha256) throw new Error("HAWAII_2026_SOURCE_DRIFT");
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, destination); }
  finally { await rm(temporary, { force: true }); }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HAWAII_2026_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
