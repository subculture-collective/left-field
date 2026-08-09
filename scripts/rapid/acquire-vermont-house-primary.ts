import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SOURCES = [
  {
    year: 2022,
    pdfPath: "data/source/rapid/house-primary/vt/2022/official-primary-canvass.pdf",
    textPath: "data/source/rapid/house-primary/vt/2022/official-primary-canvass-layout.txt",
    url: "https://outside.vermont.gov/dept/sos/Elections_Division/election_info_resources/elections_results_data/2022_primary_election_official_report_canvassing_committee_united_states_vermont_statewide_offices.pdf",
    pdfBytes: 817821,
    pdfSha256: "9e297acae57327843f07c278e1b438eb40d73650fd89262569aa806564054087",
    textBytes: 1297652,
    textSha256: "5da75e57b23fb5ebc42271461c966ade091d92fb3ba4454d66b7911c14358bf1",
  },
  {
    year: 2024,
    pdfPath: "data/source/rapid/house-primary/vt/2024/official-primary-canvass.pdf",
    textPath: "data/source/rapid/house-primary/vt/2024/official-primary-canvass-layout.txt",
    url: "https://outside.vermont.gov/dept/sos/Elections_Division/election_info_resources/elections_results_data/2024_primary_election_official_report_canvassing_committee_united_states_vermont_statewide_offices.pdf",
    pdfBytes: 875263,
    pdfSha256: "a414c1dc46e1fa3ff5544dee58993e16e0cf02f0b626abb82ba665fd2face8e6",
    textBytes: 1315055,
    textSha256: "542447cd506a17f901ec8eafb24fb48185ea383a9862bee653cee13412f7588d",
  },
] as const;

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function retain(target: string, bytes: Buffer, expectedBytes: number, expectedSha256: string) {
  if (bytes.length !== expectedBytes || digest(bytes) !== expectedSha256) throw new Error(`VERMONT_SOURCE_DIGEST_INVALID:${target}`);
  await mkdir(dirname(target), { recursive: true });
  try { await writeFile(target, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw error; }
}
async function main(root = process.cwd()) {
  for (const source of SOURCES) {
    const pdfTarget = join(root, source.pdfPath), textTarget = join(root, source.textPath);
    try {
      const pdf = await readFile(pdfTarget), text = await readFile(textTarget);
      if (pdf.length !== source.pdfBytes || digest(pdf) !== source.pdfSha256 || text.length !== source.textBytes || digest(text) !== source.textSha256) throw new Error(`VERMONT_SOURCE_CONFLICT:${source.year}`);
      process.stdout.write(`already_retained ${source.year}\n`);
      continue;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const temporaryPdf = `${pdfTarget}.partial-${process.pid}`, temporaryText = `${textTarget}.partial-${process.pid}`;
    await mkdir(dirname(pdfTarget), { recursive: true });
    const fetched = spawnSync("curl", ["--silent", "--show-error", "--location", "--fail", source.url, "--output", temporaryPdf], { encoding: "utf8" });
    if (fetched.status !== 0) throw new Error(`VERMONT_FETCH_FAILED:${source.year}:${fetched.stderr.trim()}`);
    const extracted = spawnSync("pdftotext", ["-layout", temporaryPdf, temporaryText], { encoding: "utf8" });
    if (extracted.status !== 0) throw new Error(`VERMONT_TEXT_EXTRACTION_FAILED:${source.year}:${extracted.stderr.trim()}`);
    await retain(pdfTarget, await readFile(temporaryPdf), source.pdfBytes, source.pdfSha256);
    await retain(textTarget, await readFile(temporaryText), source.textBytes, source.textSha256);
    await unlink(temporaryPdf).catch(() => undefined); await unlink(temporaryText).catch(() => undefined);
    process.stdout.write(`retained ${source.year}\n`);
  }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "VERMONT_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
