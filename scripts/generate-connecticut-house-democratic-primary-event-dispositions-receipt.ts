import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildConnecticutEventDispositionsReceipt, validateConnecticutEventDispositionsReceipt } from "../src/ingestion/elections/connecticut-house-democratic-primary-event-dispositions-receipt";
import type { NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = lock.entries.filter((entry) => /^ct-202[24]-primary-event-(?:discovery|\d+-results)-response$/.test(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const receipt = validateConnecticutEventDispositionsReceipt(buildConnecticutEventDispositionsReceipt(inputs)), output = resolve("data/metadata/connecticut-house-democratic-primary-event-dispositions-2022-2024-v1.json"), bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
if (existsSync(output)) { if (!readFileSync(output).equals(bytes)) throw new Error("CONNECTICUT_EVENT_DISPOSITIONS_OUTPUT_CONFLICT"); } else writeFileSync(output, bytes, { flag: "wx", mode: 0o644 });
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: receipt.packageSha256, summary: receipt.summary })}\n`);
