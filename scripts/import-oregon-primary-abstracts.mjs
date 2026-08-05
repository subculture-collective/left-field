import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const SOURCES = [
  { year: 2022, uri: "13735452", title: "2022 May Primary Election Official Results(2).PDF", pdf: { byteSize: 894_875, sha256: "dd885013df98d584488091ffdf69d359a3a7fe494f037276fcda60f03e15beca" }, text: { byteSize: 100_865, sha256: "f54548a8d62c374dd7324c8de6b5146d6a72e5e65c6a43d12dd5b28b9b509b14" } },
  { year: 2024, uri: "13735456", title: "2024 May Primary Election Official Results(2).PDF", pdf: { byteSize: 1_124_897, sha256: "a3d68250380c4b49fbd8a7a98548822c0c0ad870cd61b90aa98b737f259c876d" }, text: { byteSize: 105_541, sha256: "eb745e0d5c1e854c73a7a8b7007b8dc0ca14eb2458bf82490cb40a6102d375ba" } },
  { year: 2026, uri: "16180585", title: "2026 May Primary Election Official Results.PDF", pdf: { byteSize: 1_370_223, sha256: "19e936d34a664062ef0cbb89b273d87ddf3f9b3e5b994c091bf4919428d2ae3e" }, text: { byteSize: 95_691, sha256: "96222841056651bbe4e3cc638f995e5b9fc67518c9eba23c469a3552e4b9050a" } },
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const verify = (label, value, expected) => { if (value.length !== expected.byteSize || sha(value) !== expected.sha256) throw new Error(`OREGON_PRIMARY_${label}_DRIFT`); };
async function writeExact(path, bytes) { await mkdir(dirname(path), { recursive: true }); try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error?.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`OREGON_PRIMARY_OUTPUT_CONFLICT:${path}`); } }

async function acquire(source) {
  const recordUrl = `https://records.sos.state.or.us/ORSOSCMSearch/Search/RecordViewer.aspx?uri=${source.uri}`, response = await fetch(recordUrl, { headers: { "user-agent": "dsa-seats-source-acquisition/1" } });
  if (!response.ok) throw new Error(`OREGON_PRIMARY_${source.year}_VIEWER_HTTP_${response.status}`);
  const html = await response.text(), payloads = [...html.matchAll(/"data":"([A-Za-z0-9+/=]+)"/g)].map((match) => match[1]);
  if (!html.includes(source.title) || payloads.length !== 1) throw new Error(`OREGON_PRIMARY_${source.year}_VIEWER_PAYLOAD_INVALID`);
  const pdf = Buffer.from(payloads[0], "base64"); verify(`${source.year}_PDF`, pdf, source.pdf);
  const temporary = await mkdtemp(resolve(tmpdir(), `dsa-seats-or-${source.year}-`));
  try {
    const pdfPath = resolve(temporary, "source.pdf"), textPath = resolve(temporary, "source.txt"); await writeFile(pdfPath, pdf); execFileSync("pdftotext", ["-layout", pdfPath, textPath]); const text = await readFile(textPath); verify(`${source.year}_TEXT`, text, source.text);
    const output = resolve(`data/source/elections/primary-results/oregon/${source.year}`); await writeExact(resolve(output, "official-primary-abstract.pdf"), pdf); await writeExact(resolve(output, "official-primary-abstract.txt"), text);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return { year: source.year, recordUrl, pdf: source.pdf, text: source.text };
}

async function main() {
  const checked = spawnSync("pdftotext", ["-v"], { encoding: "utf8" }), version = `${checked.stdout ?? ""}${checked.stderr ?? ""}`;
  if (checked.status !== 0) throw new Error("OREGON_PRIMARY_PDFTOTEXT_UNAVAILABLE");
  if (!version.includes("pdftotext version 26.07.0")) throw new Error("OREGON_PRIMARY_PDFTOTEXT_VERSION_INVALID");
  const results = []; for (const source of SOURCES) results.push(await acquire(source)); process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
