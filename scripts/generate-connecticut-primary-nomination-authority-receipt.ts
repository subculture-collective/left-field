import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildConnecticutNominationAuthorityReceipt, validateConnecticutNominationAuthorityReceipt } from "../src/ingestion/elections/connecticut-primary-nomination-authority-receipt";

const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8"));
const receipt = validateConnecticutNominationAuthorityReceipt(buildConnecticutNominationAuthorityReceipt(lock));
const output = resolve("data/metadata/connecticut-primary-nomination-authority-receipt-v1.json");
const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
if (existsSync(output)) { if (!readFileSync(output).equals(bytes)) throw new Error("CT_NOMINATION_AUTHORITY_OUTPUT_CONFLICT"); } else writeFileSync(output, bytes, { flag: "wx", mode: 0o644 });
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: receipt.packageSha256, observationSetSha256: receipt.observationSetSha256 })}\n`);
