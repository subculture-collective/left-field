import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  { id: "ct", url: "https://portal.ct.gov/-/media/sots/electionservices/calendars/2026-elections/2026-election-calendar-122325.pdf", path: "data/source/elections/filing-authority/ct-2026-election-calendar.pdf", byteSize: 626034, sha256: "c3d95d2253b1e6b9e2bbdb64b461ed19871695493eda2df2226eec5f79f1ef55", prefix: "%PDF-" },
  { id: "wa-top-two", url: "https://www2.sos.wa.gov/_assets/elections/faq_candidates.pdf", path: "data/source/elections/filing-authority/wa-top-two-candidate-faq.pdf", byteSize: 281871, sha256: "ef08af3d2f4bc5b8184fc7cd3ea7a2eafdbf4785158c147ccbc2f243f4f15ac0", prefix: "%PDF-" },
];

for (const source of sources) {
  const response = await fetch(source.url, { redirect: "follow", headers: { accept: source.prefix === "%PDF-" ? "application/pdf" : "text/html", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`FILING_AUTHORITY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer()); const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== source.byteSize || sha256 !== source.sha256 || !bytes.subarray(0, source.prefix.length).equals(Buffer.from(source.prefix))) throw new Error(`FILING_AUTHORITY_SOURCE_DRIFT:${source.id}`);
  const output = resolve(source.path);
  await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { mode: 0o644, flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(output)).equals(bytes)) throw new Error(`FILING_AUTHORITY_OUTPUT_CONFLICT:${source.id}`); }
}
process.stdout.write(`${JSON.stringify({ retained: sources.map(({ id, path, byteSize, sha256 }) => ({ id, path: resolve(path), byteSize, sha256 })) }, null, 2)}\n`);
