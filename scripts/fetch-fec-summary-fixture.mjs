import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

// These are filing-level responses only.  Do not persist their CSV bodies: they can
// contain contributor-level disclosed information.
const filings = [
  { id: "1920279", shard: "279", hash: "08c753ee7111a88ed4ae483e4005323423cc26c07d23603e329008ed0d411c62", size: 131756, amendmentNumber: 0, filedAt: "2025-10-15", rootFilingId: "1920279", amendsSourceFilingId: null },
  { id: "1922049", shard: "049", hash: "0d9a0179ccbcddb95d69db65784a056a9c0eb8ad3bad9495052933d8cc6734d4", size: 131739, amendmentNumber: 1, filedAt: "2025-10-16", rootFilingId: "1920279", amendsSourceFilingId: "1920279" },
  { id: "1946508", shard: "508", hash: "4f4e948a9cc961c619d8e80b76377a60f18ad2dd12ed7cffd187c592e4800b2f", size: 135763, amendmentNumber: 2, filedAt: "2026-02-13", rootFilingId: "1920279", amendsSourceFilingId: "1922049" },
  { id: "1973409", shard: "409", hash: "2536d97136c25d262f3d24a4207a708bfd0887b4ecbeea10c1f613276a8cc2bc", size: 135841, amendmentNumber: 3, filedAt: "2026-05-07", rootFilingId: "1920279", amendsSourceFilingId: "1946508" },
];

// RFC 4180 scanner: parsing verifies that the response is structured CSV without
// exposing or retaining any schedule rows.
function firstCsvRows(text, limit = 2) { let quoted = false; let field = ""; let row = []; const rows = []; for (let i = 0; i < text.length; i += 1) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { field += c; i += 1; } else quoted = !quoted; } else if (c === "," && !quoted) { row.push(field); field = ""; } else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i += 1; row.push(field); field = ""; if (row.length && rows.length < limit) rows.push(row); row = []; } else field += c; } if (quoted) throw new Error("Malformed quoted CSV response"); return rows; }

const summaries = [];
for (const filing of filings) {
  const url = `https://docquery.fec.gov/csv/${filing.shard}/${filing.id}.csv`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const [header, report] = firstCsvRows(bytes.toString("utf8"));
  if (hash !== filing.hash || bytes.length !== filing.size) throw new Error(`${filing.id}: pinned response drift; review before changing expectations`);
  if (header?.[0] !== "HDR" || !report || !["F3N", "F3A"].includes(report[0])) throw new Error(`${filing.id}: unexpected FEC records`);
  const sourceAmendment = header[6] === "" ? 0 : Number(header[6]);
  if (sourceAmendment !== filing.amendmentNumber || report[22] !== filing.filedAt.replaceAll("-", "")) throw new Error(`${filing.id}: amendment or filing-date mismatch`);
  summaries.push({ sourceFilingId: filing.id, url, fullResponseSha256: hash, fullResponseByteSize: bytes.length, formType: report[0], committeeId: report[1], committeeName: report[2], reportType: report[11], electionState: report[9], electionDistrict: report[10], coverageStart: `${report[15].slice(0, 4)}-${report[15].slice(4, 6)}-${report[15].slice(6)}`, coverageEnd: `${report[16].slice(0, 4)}-${report[16].slice(4, 6)}-${report[16].slice(6)}`, filedAt: filing.filedAt, amendmentNumber: filing.amendmentNumber, rootFilingId: filing.rootFilingId, amendsSourceFilingId: filing.amendsSourceFilingId });
}
await mkdir("data/source/fec", { recursive: true });
await writeFile("data/source/fec/summary-filings.json", `${JSON.stringify({ generatedFrom: "four official FEC responses; bodies intentionally not retained", filings: summaries }, null, 2)}\n`);
