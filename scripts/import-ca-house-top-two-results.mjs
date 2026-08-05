import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.CA_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) throw new Error("CA_PRIMARY_IMPORT_DIR_REQUIRED");

const root = "data/source/elections/primary-results/california";
const files = [
  ["2022-house.xlsx", `${root}/2022/house-statement-of-vote.xlsx`, 33283, "c4a5ed1cea81cc88884122c9d787109263bb42630d97466f7b51d3d4125813e0", "PK"],
  ["2022-house.pdf", `${root}/2022/house-statement-of-vote.pdf`, 195011, "0ac1770a5d0afa0f29e5e8525e28f401fe1795e070eac3179e76c62a8bbe4ea0", "%PDF"],
  ["2022-certificate.pdf", `${root}/2022/secretary-certificate.pdf`, 210247, "af936a5825a1aa9fd6de6912b9ae88008acfa9dee4a95a312025eab7e3180679", "%PDF"],
  ["2024-house.xlsx", `${root}/2024/house-statement-of-vote.xlsx`, 32488, "bf08e726fda50cb1b7f1ec83b7d7e0000d82bf215bc0d953b26aa77a6dde1a86", "PK"],
  ["2024-house.pdf", `${root}/2024/house-statement-of-vote.pdf`, 197272, "e66700815a0c87ab1faa1509178a58a333707a5328a7da807ee3f05034c0a6aa", "%PDF"],
  ["2024-certificate.pdf", `${root}/2024/secretary-certificate.pdf`, 1003961, "1d9adbbebedb50980432e17077654af6e5ecdf264c47a6849d056eb8ffa7cb8f", "%PDF"],
  ["2024-cd16-recertification.pdf", `${root}/2024/cd16-recertification.pdf`, 1019737, "2e45b8d23631d2ee290d7969f5c6a8777ee7812cb975af68be549ee39345f145", "%PDF"],
  ["2026-house.xlsx", `${root}/2026/house-statement-of-vote.xlsx`, 320003, "0f84023a857d8f1cba5da0565cf334d9c362a0bb96f2172cf8bc1771bc019770", "PK"],
  ["2026-house.pdf", `${root}/2026/house-statement-of-vote.pdf`, 223964, "4dca429c463c2cf32dc37342f8f5f3e87429cd1345109f208e0c437e7be7f4d5", "%PDF"],
  ["2026-certificate.pdf", `${root}/2026/secretary-certificate.pdf`, 842458, "3ffb90f022e448d84ea77cfccc2baa54ad87669a0aaa0575c7a08df66c460d77", "%PDF"],
  ["top-two-primary-rules.html", `${root}/authority/top-two-primary-rules-20260805.html`, 64796, "4840655c057c2ec71aacbcf40798ba25126ae8b42d96b673e41a8748e8f2f917", "<!DO"],
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [sourceName, retainedPath, byteSize, sha256, magic] of files) {
  const sourcePath = resolve(sourceDirectory, sourceName);
  const bytes = await readFile(sourcePath);
  if (bytes.length !== byteSize || hash(bytes) !== sha256 || !bytes.subarray(0, magic.length).toString("latin1").startsWith(magic)) {
    throw new Error(`CA_PRIMARY_SOURCE_BYTES_INVALID: ${sourceName}`);
  }
  await mkdir(dirname(retainedPath), { recursive: true });
  await copyFile(sourcePath, retainedPath);
}

const normalizedPath = `${root}/normalized/house-candidate-totals.tsv`;
await mkdir(dirname(normalizedPath), { recursive: true });
const extraction = spawnSync("python", [
  "scripts/extract-california-house-top-two-results.py",
  "--input-dir", root,
  "--output", normalizedPath,
], { encoding: "utf8" });
if (extraction.status !== 0) throw new Error(`CA_PRIMARY_EXTRACTION_FAILED: ${extraction.stderr || extraction.stdout}`);
const normalized = await readFile(normalizedPath);
if (normalized.length !== 43429 || hash(normalized) !== "94f110f4cef4ac2f7d8fd32e7765318372a81280fcf2995b7ca1563a1f59bebc") {
  throw new Error("CA_PRIMARY_NORMALIZED_EXTRACT_INVALID");
}
console.log(JSON.stringify({ imported: files.length, normalizedPath, normalizedByteSize: normalized.length, normalizedSha256: hash(normalized), sourceDirectory }, null, 2));
