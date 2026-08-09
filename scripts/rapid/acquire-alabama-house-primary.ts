import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const SOURCES = [
  { path: "data/source/rapid/house-primary/al/2022/primary-precinct-results.zip", url: "https://www.sos.alabama.gov/sites/default/files/election-data/2022-06/2022%20Primary%20Precinct%20Results.zip", bytes: 956619, sha256: "d927aa38b0be4f855833648aeb873a537db8a222172bb630044b026622a23999" },
  { path: "data/source/rapid/house-primary/al/2024/primary-precinct-results.zip", url: "https://www.sos.alabama.gov/sites/default/files/election-data/2024-04/2024%20Primary%20Precinct%20Results.ZIP", bytes: 705832, sha256: "8423328e37a00b430d23ea034547bc354d2c71f4038c950a4dc882aa08333cd2" },
  { path: "data/source/rapid/house-primary/al/2024/primary-runoff-precinct-results.zip", url: "https://www.sos.alabama.gov/sites/default/files/election-data/2024-07/2024%20Primary%20Runoff%20Precinct%20Results.zip", bytes: 165748, sha256: "1538e5a6848a4989fe856cf538dd279f4992a8c9fdac6d6cd03978ad8017cdae" },
] as const;

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main(root = process.cwd()) {
  for (const source of SOURCES) {
    const target = join(root, source.path);
    try {
      const existing = await readFile(target);
      if (existing.length !== source.bytes || digest(existing) !== source.sha256) throw new Error(`ALABAMA_SOURCE_CONFLICT:${source.path}`);
      process.stdout.write(`already_retained ${source.path}\n`);
      continue;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.partial-${process.pid}`;
    const result = spawnSync("curl", ["--insecure", "--silent", "--show-error", "--location", "--fail", source.url, "--output", temporary], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ALABAMA_FETCH_FAILED:${source.url}:${result.stderr.trim()}`);
    const bytes = await readFile(temporary);
    if (bytes.length !== source.bytes || digest(bytes) !== source.sha256) throw new Error(`ALABAMA_SOURCE_DIGEST_INVALID:${source.path}`);
    try { await writeFile(target, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw error; }
    await unlink(temporary).catch(() => undefined);
    process.stdout.write(`retained ${source.path}\n`);
  }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "ALABAMA_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
