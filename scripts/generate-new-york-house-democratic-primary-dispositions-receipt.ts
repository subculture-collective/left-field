import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildNewYorkPrimaryDispositionsReceipt } from "../src/ingestion/elections/new-york-house-democratic-primary-dispositions-receipt";
import type { NewYorkReportedResultsReceipt, NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const certifications = lock.entries.filter((entry) => /^ny-202[24]-house-primary-ballot-certification$/.test(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const reportedResults = JSON.parse(readFileSync(resolve("data/metadata/new-york-house-democratic-primary-reported-results-2022-2024-v1.json"), "utf8")) as NewYorkReportedResultsReceipt;
const receipt = buildNewYorkPrimaryDispositionsReceipt({ certifications, reportedResults });
const output = resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v1.json");
const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(output, bytes);
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: receipt.packageSha256, dispositionSetSha256: receipt.summary.dispositionSetSha256, summary: receipt.summary })}\n`);
