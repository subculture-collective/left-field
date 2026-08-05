import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  {
    cycle: "nj-statute",
    url: "https://www.nj.gov/state/dos-statutes-elections-19-20-29.shtml",
    output: "data/source/elections/primary-results/certification/new-jersey/election-statutes-title-19-chapters-20-29.html",
    byteSize: 299631,
    sha256: "1750d1b98e082d43f24f7c5378179d03e4c80d60fb3232f3be5042af836a6bae",
    phrases: [
      "NJSA 19:23-57 Canvass of votes by secretary of state; certificates of election issued",
      "The secretary of state shall forthwith canvass such statements of the county  clerks",
      "shall issue a certificate of election to each person shown by such canvass",
    ],
  },
  {
    cycle: "pa-authority-boundary",
    url: "https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data",
    output: "data/source/elections/primary-results/certification/pennsylvania/election-data-authority-boundary.html",
    byteSize: 409399,
    sha256: "33fb658f191c7fa728a248427bc08b03cf02bfdd27c70dfc32966b8d1505f6cf",
    phrases: [
      "Returns remain unofficial until certified",
      "Official countywide election returns are tabulated by the department and certified under the Seal",
      "Official precinct election returns are maintained by the county boards of elections",
    ],
  },
  {
    cycle: 2024,
    url: "https://www.pa.gov/agencies/dos/newsroom/secretary-of-the-commonwealth-certifies-2024-primary-election-re",
    output: "data/source/elections/primary-results/certification/pennsylvania/2024-primary-certification.html",
    byteSize: 206814,
    sha256: "faac7574af526b4bd82fd7bea2be33053dc26808e92289e8e272cb180826dc5b",
    phrases: [
      "all 67 counties certified their results to the Department of State",
      "certified the results of Pennsylvania’s 2024 primary election",
      "All results are official",
    ],
  },
  {
    cycle: 2026,
    url: "https://www.pa.gov/agencies/dos/newsroom/secretary-of-the-commonwealth-certifies-2026-primary-election-re",
    output: "data/source/elections/primary-results/certification/pennsylvania/2026-primary-certification.html",
    byteSize: 207082,
    sha256: "cc4b87be3cf4c86d40ad0a1f219340aba98a838b7127495397bd45a7e544c3e8",
    phrases: [
      "certified the results of Pennsylvania’s 2026 primary election",
      "received certified results from all 67 counties",
      "signed the official certification document",
    ],
  },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function writeExact(path, bytes) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(target, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (error?.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw new Error(`PRIMARY_CERTIFICATION_OUTPUT_CONFLICT:${path}`);
  }
}

for (const source of sources) {
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: "text/html", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`PRIMARY_CERTIFICATION_FETCH_FAILED:${source.cycle}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString("utf8");
  if (bytes.byteLength !== source.byteSize || sha256(bytes) !== source.sha256) throw new Error(`PRIMARY_CERTIFICATION_BYTES_DRIFTED:${source.cycle}`);
  if (source.phrases.some((phrase) => !text.includes(phrase))) throw new Error(`PRIMARY_CERTIFICATION_SEMANTICS_MISSING:${source.cycle}`);
  await writeExact(source.output, bytes);
  process.stdout.write(`${JSON.stringify({ cycle: source.cycle, output: resolve(source.output), byteSize: bytes.byteLength, sha256: sha256(bytes) })}\n`);
}
