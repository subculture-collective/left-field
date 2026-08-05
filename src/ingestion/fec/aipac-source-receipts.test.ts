import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyAipacSourceReceipts } from "./aipac-source-receipts";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const sourcePackage = (sources: unknown[]) => ({ packageVersion: "aipac-source-receipts-v1", sourceCutoff: "2026-07-18", acquiredAt: "2026-08-04T21:44:26-05:00", sources });
const receipt = (cycleYear: number, channel: "aipac_pac_pas2" | "udp_bulk_ie_reconciliation", value: string) => ({ id: `${channel}-${cycleYear}`, cycleYear, channel, sourceUrl: `https://www.fec.gov/files/bulk-downloads/${cycleYear}/${channel === "aipac_pac_pas2" ? `pas2${String(cycleYear).slice(2)}.zip` : `independent_expenditure_${cycleYear}.csv`}`, filename: channel === "aipac_pac_pas2" ? `pas2${String(cycleYear).slice(2)}.zip` : `independent_expenditure_${cycleYear}.csv`, byteSize: Buffer.byteLength(value), sha256: sha(value), retrievedAt: "2026-08-04T21:44:26-05:00", matchedCommitteeRows: 1, primaryCodedRows: channel === "aipac_pac_pas2" ? 1 : null, uniqueFileNumbers: channel === "aipac_pac_pas2" ? 1 : null, coverageClaim: false, closureGap: channel === "aipac_pac_pas2" ? "cutoff_filing_ledger_missing" : "reconciliation_source_not_complete_authority" });

describe("AIPAC source receipts", () => {
  it("verifies all six exact source objects while keeping coverage unclaimed", async () => {
    const root = await mkdtemp(join(tmpdir(), "aipac-receipts-"));
    try {
      const sources = [2022, 2024, 2026].flatMap((cycle) => [receipt(cycle, "aipac_pac_pas2", `pas2-${cycle}`), receipt(cycle, "udp_bulk_ie_reconciliation", `ie-${cycle}`)]);
      await Promise.all(sources.map((source, index) => writeFile(join(root, source.filename), index % 2 === 0 ? `pas2-${source.cycleYear}` : `ie-${source.cycleYear}`)));
      const verified = await verifyAipacSourceReceipts(root, sourcePackage(sources));
      expect(verified.sources).toHaveLength(6);
      expect(verified.sources.every((source) => source.coverageClaim === false)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a changed source object and incomplete cycle/channel closure", async () => {
    const root = await mkdtemp(join(tmpdir(), "aipac-receipts-"));
    try {
      const sources = [2022, 2024, 2026].flatMap((cycle) => [receipt(cycle, "aipac_pac_pas2", `pas2-${cycle}`), receipt(cycle, "udp_bulk_ie_reconciliation", `ie-${cycle}`)]);
      await Promise.all(sources.map((source, index) => writeFile(join(root, source.filename), index % 2 === 0 ? `pas2-${source.cycleYear}` : `ie-${source.cycleYear}`)));
      await writeFile(join(root, sources[0]!.filename), "changed");
      await expect(verifyAipacSourceReceipts(root, sourcePackage(sources))).rejects.toThrow("FEC_AIPAC_RECEIPT_MISMATCH");
      await expect(verifyAipacSourceReceipts(root, sourcePackage(sources.slice(1)))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
