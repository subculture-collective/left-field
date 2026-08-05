import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildNewYorkPrimaryDispositionsV2Receipt, validateNewYorkPrimaryDispositionsV2Receipt } from "../src/ingestion/elections/new-york-house-democratic-primary-dispositions-v2-receipt";
import type { NycCertifiedResultsReceipt } from "../src/ingestion/elections/new-york-city-house-democratic-primary-certified-results-receipt";
import type { NewYorkPrimaryDispositionsReceipt } from "../src/ingestion/elections/new-york-house-democratic-primary-dispositions-receipt";

const stateDisposition = JSON.parse(readFileSync(resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v1.json"), "utf8")) as NewYorkPrimaryDispositionsReceipt;
const nycCertifiedResults = JSON.parse(readFileSync(resolve("data/metadata/new-york-city-house-democratic-primary-certified-results-2022-2024-v1.json"), "utf8")) as NycCertifiedResultsReceipt;
const receipt = validateNewYorkPrimaryDispositionsV2Receipt(buildNewYorkPrimaryDispositionsV2Receipt({ stateDisposition, nycCertifiedResults }));
const output = resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"), bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
if (existsSync(output)) { if (!readFileSync(output).equals(bytes)) throw new Error("NEW_YORK_DISPOSITIONS_V2_OUTPUT_CONFLICT"); } else writeFileSync(output, bytes, { flag: "wx", mode: 0o644 });
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: receipt.packageSha256, dispositionSetSha256: receipt.summary.dispositionSetSha256, summary: receipt.summary })}\n`);
