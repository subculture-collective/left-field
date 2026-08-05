import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMarylandPrimaryResultsReceipt, validateMarylandPrimaryResultsReceipt } from "../src/ingestion/elections/maryland-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = lock.entries.filter((entry) => /^md-202[24]-democratic-primary-congressional-breakdown$/.test(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const receipt = validateMarylandPrimaryResultsReceipt(buildMarylandPrimaryResultsReceipt(inputs)), output = resolve("data/metadata/maryland-house-democratic-primary-results-2022-2024-v1.json"), bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
if (existsSync(output)) { if (!readFileSync(output).equals(bytes)) throw new Error("MARYLAND_PRIMARY_RESULTS_OUTPUT_CONFLICT"); } else writeFileSync(output, bytes, { flag: "wx", mode: 0o644 });
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: receipt.packageSha256, summary: receipt.summary })}\n`);
