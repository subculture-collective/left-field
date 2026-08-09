import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  ["1041", "clerk-of-circuit-court", 80516, "be9750dad217dbb46cbcec0584768284f09f31ade93cc7db0e33f2e1472be732"],
  ["1011", "county-auditor", 72809, "c8b7af06a5047950ed299662756577f310fb850ec45a6c0780fda515861a1eac"],
  ["1015", "county-recorder", 87709, "d79014f8b4be19e9aa60671fa735d8b495f18f47dfaacec459fbd8d2f0aeb1a1"],
  ["1025", "county-treasurer", 144628, "37fca5c9a5b8ec744ad2dbf71cf4f7311c84f572c39e46b515b61925ab7b385a"],
  ["1004", "county-coroner", 139138, "f7700920b81ad6699f51c5f5974d6fe643b2200ff7d219b295559b667f2d49a6"],
  ["1029", "county-surveyor", 121855, "5ffe7a12608acb84669c3d7a43022c4653ef300a88fd355d437d2a89a216350b"],
  ["1033", "county-council-member", 420463, "09a928bfc5868167ea80dc6e23d2b4aaffde85d129de94e7b72ab467316bb770"],
  ["1023", "township-board-member", 106125, "c1a9e2fd3bd491e2a4ef086c40220e10fe1b4d2d137a1b1e531ac67a974d28b4"],
  ["1032", "city-county-or-city-council-member", 35398, "97d8d8fabad229e2fffa4edc4cbebe973ca5b410ccb04223f3cc8bae451b9f3b"],
  ["1001", "town-clerk-treasurer", 48672, "73cc31b731028411fb9de401f526d323c4aae0ff2dffe4be05796f492ee60cb2"],
  ["1037", "town-council-member", 121797, "6fb8260e6e177a2479402df5965c793011d785f720113bf1d4bd57db3ddbbe47"],
] as const;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() { for (const [id, slug, size, digest] of sources) { const path = `data/source/rapid/county-office/in/2024/${slug}-results.json`, url = `https://enr.indianavoters.in.gov/archive/2024Primary/data/OffCatC_${id}_B.json`; let existing: Buffer | null = null; try { existing = await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } if (existing) { if (existing.length !== size || sha(existing) !== digest) throw new Error(`INDIANA_LOCAL_OFFICE_CONFLICT:${id}`); continue; } const response = await fetch(url, { redirect: "error" }); if (!response.ok || response.url !== url) throw new Error(`INDIANA_LOCAL_OFFICE_FETCH_FAILED:${id}:${response.status}`); const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length !== size || sha(bytes) !== digest) throw new Error(`INDIANA_LOCAL_OFFICE_BYTES_INVALID:${id}`); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: "wx" }); } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_LOCAL_OFFICE_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
