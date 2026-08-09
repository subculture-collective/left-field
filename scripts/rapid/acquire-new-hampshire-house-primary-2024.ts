import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  {
    url: "https://web.archive.org/web/20260218161927id_/https://www.sos.nh.gov/sites/g/files/ehbemt561/files/inline-documents/sonh/2024-sp-congressional-district-1-democratic_4.xlsx",
    path: "data/source/rapid/house-primary/nh/2024/congressional-district-1-democratic.xlsx",
    bytes: 28_223,
    sha256: "79713159348e24389f2e115f0cc77bc3acd016b6ea2a90e1366e6a8166a55593",
  },
  {
    url: "https://web.archive.org/web/20260218161927id_/https://www.sos.nh.gov/sites/g/files/ehbemt561/files/inline-documents/sonh/2024-sp-congressional-district-2-democratic_4.xlsx",
    path: "data/source/rapid/house-primary/nh/2024/congressional-district-2-democratic.xlsx",
    bytes: 37_838,
    sha256: "1f6dfb3b1d759f89845f5947add0b4cd8867ad2da442e2f501046f796809ec92",
  },
] as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function retain(source: (typeof sources)[number]) {
  try {
    const bytes = await readFile(source.path);
    if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEW_HAMPSHIRE_2024_SOURCE_CONFLICT:${source.path}`);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`NEW_HAMPSHIRE_2024_FETCH_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEW_HAMPSHIRE_2024_SOURCE_DRIFT:${source.path}`);
  await mkdir(dirname(source.path), { recursive: true });
  const temporary = `${source.path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, source.path); } finally { await rm(temporary, { force: true }); }
}

Promise.all(sources.map(retain)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "NEW_HAMPSHIRE_2024_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
