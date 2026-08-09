import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SOURCE = {
  url: "https://www.elections.tn.gov/categories/congressional/offices",
  path: "data/source/rapid/house-primary/tn/2026/congressional-results.html",
  bytes: 70_586,
  sha256: "3bc6693f8f732a120ceb0c1e5cf947dfaa601b6fb8099a930a9c1245406cc9ea",
} as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const destination = join(process.cwd(), SOURCE.path);
  try {
    const existing = await readFile(destination);
    if (existing.length !== SOURCE.bytes || sha(existing) !== SOURCE.sha256) throw new Error("TENNESSEE_2026_SOURCE_CONFLICT");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // The portal varies its accessibility wrapper by user agent. Pin the compact
  // curl representation so repeated acquisition produces the same source bytes.
  const response = await fetch(SOURCE.url, { headers: { accept: "text/html", "user-agent": "curl/8.16.0" } });
  if (!response.ok) throw new Error(`TENNESSEE_2026_FETCH_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== SOURCE.bytes || sha(bytes) !== SOURCE.sha256) throw new Error("TENNESSEE_2026_SOURCE_DRIFT");
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, destination); }
  finally { await rm(temporary, { force: true }); }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "TENNESSEE_2026_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
