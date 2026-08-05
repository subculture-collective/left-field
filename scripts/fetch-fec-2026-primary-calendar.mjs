import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const url = "https://www.fec.gov/resources/cms-content/documents/2026pdates.pdf";
const output = resolve("data/source/elections/fec-2026-congressional-primary-dates.pdf");
const expected = { byteSize: 226820, sha256: "9a5d4ec0ba2b69daf2f510ef79bca0ca381ab699255ac5adb971b9672d517251" };

const response = await fetch(url, { redirect: "follow", headers: { accept: "application/pdf", "user-agent": "dsa-seats-source-lock/1.0" } });
if (!response.ok) throw new Error(`FEC_2026_CALENDAR_FETCH_FAILED:${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (bytes.byteLength !== expected.byteSize || sha256 !== expected.sha256 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("FEC_2026_CALENDAR_SOURCE_DRIFT");
try { await writeFile(output, bytes, { mode: 0o644, flag: "wx" }); }
catch (error) {
  if (error.code !== "EEXIST") throw error;
  if (!(await readFile(output)).equals(bytes)) throw new Error("FEC_2026_CALENDAR_OUTPUT_CONFLICT");
}
process.stdout.write(`${JSON.stringify({ output, url, ...expected }, null, 2)}\n`);
