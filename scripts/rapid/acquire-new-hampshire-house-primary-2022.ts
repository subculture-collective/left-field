import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  {
    url: "https://web.archive.org/web/20250613143126id_/https://www.sos.nh.gov/sites/g/files/ehbemt561/files/inline-documents/sonh/2022-sp-congressional-district-1-democratic.xlsx",
    path: "data/source/rapid/house-primary/nh/2022/congressional-district-1-democratic.xlsx",
    bytes: 18_779,
    sha256: "251da7809640050d0b5140b39ba2ec0f6e32aeea1bed4f90db89789f270eba25",
  },
  {
    url: "https://web.archive.org/web/20250613143132id_/https://www.sos.nh.gov/sites/g/files/ehbemt561/files/inline-documents/sonh/2022-sp-congressional-district-2-democratic_1.xlsx",
    path: "data/source/rapid/house-primary/nh/2022/congressional-district-2-democratic.xlsx",
    bytes: 22_696,
    sha256: "856b0e14aacb6455772cb7e4cb24af33dd2bb5c1357a37e8a04b16e60811da1f",
  },
] as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function retain(source: (typeof sources)[number]) {
  try {
    const bytes = await readFile(source.path);
    if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEW_HAMPSHIRE_2022_SOURCE_CONFLICT:${source.path}`);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`NEW_HAMPSHIRE_2022_FETCH_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEW_HAMPSHIRE_2022_SOURCE_DRIFT:${source.path}`);
  await mkdir(dirname(source.path), { recursive: true });
  const temporary = `${source.path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { flag: "wx" });
  try { await rename(temporary, source.path); } finally { await rm(temporary, { force: true }); }
}

Promise.all(sources.map(retain)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "NEW_HAMPSHIRE_2022_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
