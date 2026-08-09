import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const sources = [
  {
    cycleYear: 2022,
    url: "https://elections.wi.gov/sites/default/files/documents/County%20by%20County%20Report%20-%202022%20Partisan%20Primary%20-%20Representative%20in%20Congress.pdf",
    pdfPath: "data/source/rapid/house-primary/wi/2022/us-house-county-canvass.pdf",
    pdfBytes: 62_922,
    pdfSha256: "9a921cfe761166050aaf4e8b2c83f57bd5bdbd38c1fbfd7ee746664dbaa55b99",
    textPath: "data/source/rapid/house-primary/wi/2022/us-house-county-canvass-layout.txt",
    textBytes: 47_260,
    textSha256: "eec6844d29f41ece59838092030428bb5e08e51354a6dcf2400c4c895380f6a0",
  },
  {
    cycleYear: 2024,
    url: "https://elections.wi.gov/sites/default/files/documents/County%20by%20County%20Report_US%20Congress.pdf",
    pdfPath: "data/source/rapid/house-primary/wi/2024/us-house-county-canvass.pdf",
    pdfBytes: 138_308,
    pdfSha256: "c2a846f2abdf219b2680bbd654343e98df1993b5ea56f99718f0d0d5d6945fc7",
    textPath: "data/source/rapid/house-primary/wi/2024/us-house-county-canvass-layout.txt",
    textBytes: 57_350,
    textSha256: "eb46a429a904921ac2bd2a11a9a445e96e02a1f11101b18f4bb16146f25c4b58",
  },
] as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const retain = async (path: string, bytes: Buffer, expectedBytes: number, expectedSha256: string, code: string) => {
  if (bytes.length !== expectedBytes || sha(bytes) !== expectedSha256) throw new Error(`${code}_DRIFT`);
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`${code}_OUTPUT_CONFLICT`); }
};

async function main() {
  const temp = await mkdtemp(join(tmpdir(), "dsa-seats-wisconsin-primary-"));
  try {
    for (const source of sources) {
      const response = await fetch(source.url, { headers: { "user-agent": "Mozilla/5.0 dsa-seats factual source acquisition contact=admin@dsaslate.us", referer: "https://elections.wi.gov/elections/election-results" } });
      if (!response.ok) throw new Error(`WISCONSIN_PRIMARY_FETCH_HTTP:${source.cycleYear}:${response.status}`);
      const pdf = Buffer.from(await response.arrayBuffer());
      await retain(source.pdfPath, pdf, source.pdfBytes, source.pdfSha256, `WISCONSIN_PRIMARY_PDF:${source.cycleYear}`);
      const tempPdf = join(temp, `${source.cycleYear}.pdf`), tempText = join(temp, `${source.cycleYear}.txt`);
      await writeFile(tempPdf, pdf, { flag: "wx" });
      await run("pdftotext", ["-layout", tempPdf, tempText]);
      await retain(source.textPath, await readFile(tempText), source.textBytes, source.textSha256, `WISCONSIN_PRIMARY_TEXT:${source.cycleYear}`);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
  process.stdout.write(`${JSON.stringify({ retained: sources.map(({ cycleYear, pdfPath, pdfBytes, pdfSha256, textPath, textBytes, textSha256 }) => ({ cycleYear, pdfPath, pdfBytes, pdfSha256, textPath, textBytes, textSha256 })) }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "WISCONSIN_PRIMARY_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
