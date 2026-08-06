import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildNewYorkPrimaryDispositionsV3Receipt, validateNewYorkPrimaryDispositionsV3Receipt } from "../src/ingestion/elections/new-york-house-democratic-primary-dispositions-v3-receipt";
import type { NewYorkMetroPrimaryCountyAuthorityReceipt } from "../src/ingestion/elections/new-york-metro-primary-county-authority-receipt";
import type { NewYorkPrimaryDispositionsV2Receipt } from "../src/ingestion/elections/new-york-house-democratic-primary-dispositions-v2-receipt";

const dispositionV2 = JSON.parse(readFileSync(resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"), "utf8")) as NewYorkPrimaryDispositionsV2Receipt;
const countyAuthority = JSON.parse(readFileSync(resolve("data/metadata/new-york-metro-house-democratic-primary-county-authority-receipt-v1.json"), "utf8")) as NewYorkMetroPrimaryCountyAuthorityReceipt;
const receipt = validateNewYorkPrimaryDispositionsV3Receipt(buildNewYorkPrimaryDispositionsV3Receipt({ dispositionV2, countyAuthority }));
const output = resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v3.json");
const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
if (existsSync(output)) { if (!readFileSync(output).equals(bytes)) throw new Error("NEW_YORK_DISPOSITIONS_V3_OUTPUT_CONFLICT"); } else writeFileSync(output, bytes, { flag: "wx", mode: 0o644 });
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: receipt.packageSha256, dispositionSetSha256: receipt.summary.dispositionSetSha256, summary: receipt.summary })}\n`);
