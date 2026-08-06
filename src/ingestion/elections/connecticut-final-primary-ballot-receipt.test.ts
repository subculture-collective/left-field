import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildConnecticutFinalPrimaryBallotReceipt, validateConnecticutFinalPrimaryBallotReceipt } from "./connecticut-final-primary-ballot-receipt";

const load = () => ({ catalogBytes: readFileSync(resolve("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json")), sourceLock: JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) });
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
// Deliberately mutable adversarial shape for fully rehashed mutation tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutableReceipt = Record<string, any>;
const rehash = (receipt: MutableReceipt) => {
  receipt.documents.forEach((row: MutableReceipt) => { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:ct-final-primary-ballot-document:v1\0", unsigned); });
  receipt.townRows.forEach((row: MutableReceipt) => { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:ct-final-primary-ballot-town:v1\0", unsigned); });
  receipt.documentSetSha256 = digest("dsa-seats:ct-final-primary-ballot-document-set:v1\0", receipt.documents.map(({ documentId, rowSha256 }: MutableReceipt) => ({ documentId, rowSha256 })));
  receipt.townRowSetSha256 = digest("dsa-seats:ct-final-primary-ballot-town-set:v1\0", receipt.townRows.map(({ observationId, rowSha256 }: MutableReceipt) => ({ observationId, rowSha256 })));
  const unsigned = { ...receipt }; delete unsigned.documentSetSha256; delete unsigned.townRowSetSha256; delete unsigned.packageSha256;
  receipt.packageSha256 = digest("dsa-seats:ct-final-primary-ballot-package:v1\0", unsigned);
  return receipt;
};

describe("Connecticut final primary ballot receipt", () => {
  it("closes the official posted-ballot corpus without making nomination or result claims", () => {
    const receipt = buildConnecticutFinalPrimaryBallotReceipt(load());
    expect(receipt.summary).toEqual({ indexSources: 2, townCycleRows: 338, linkedDemocraticBallots: 196, noDemocraticBallotLinkRows: 142, linkedBallotsWithHouseOfficeContest: 0, directTextReviewDocuments: 193, ocrVisualReviewDocuments: 3, nominationConclusions: 0, resultConclusions: 0, scoreEligibleRows: 0 });
    expect(receipt.indexCoverage).toEqual([{ cycleYear: 2022, sourceLockId: "ct-2022-primary-town-ballot-index", townRows: 169, democraticBallotLinks: 168, noDemocraticBallotLinkRows: 1 }, { cycleYear: 2024, sourceLockId: "ct-2024-primary-sample-ballot-index", townRows: 169, democraticBallotLinks: 28, noDemocraticBallotLinkRows: 141 }]);
    expect(receipt.documents.filter((row) => row.reviewMethod === "ocr_visual_review").map((row) => row.townLabel)).toEqual(["Chaplin", "Lebanon", "Stamford"]);
    expect(receipt.townRows.filter((row) => row.democraticBallotStatus === "no_democratic_ballot_link_on_official_index")).toHaveLength(142);
    expect(receipt.documents.every((row) => row.houseOfficeContestRows === 0 && row.nominationStatus === null && row.resultStatus === null && !row.scoreEligible)).toBe(true);
    expect(receipt.townRows.every((row) => row.noPrimaryConclusion === null && row.nominationStatus === null && row.resultStatus === null && !row.scoreEligible)).toBe(true);
    expect(JSON.stringify(receipt)).not.toMatch(/residentialAddress|streetAddress|phone|zipCode/i);
  });

  it("rejects substituted or reparented source-lock entries", () => {
    for (const mutate of [
      (entry: MutableReceipt) => { entry.url = "https://example.invalid/replaced.pdf"; },
      (entry: MutableReceipt) => { entry.sha256 = "0".repeat(64); },
      (entry: MutableReceipt) => { entry.retainedPath = "data/source/replaced.pdf"; },
      (entry: MutableReceipt) => { entry.parentIds = []; },
    ]) {
      const input = load() as MutableReceipt;
      const entry = input.sourceLock.entries.find((candidate: MutableReceipt) => candidate.id === "ct-2024-democratic-primary-ballot-stamford");
      mutate(entry);
      expect(() => buildConnecticutFinalPrimaryBallotReceipt(input as never)).toThrow("CT_FINAL_PRIMARY_BALLOT_RECEIPT_INVALID");
    }
  });

  it("rejects catalog truncation or byte drift", () => {
    const input = load();
    input.catalogBytes = Buffer.concat([input.catalogBytes, Buffer.from(" ")]);
    expect(() => buildConnecticutFinalPrimaryBallotReceipt(input)).toThrow("CT_FINAL_PRIMARY_BALLOT_RECEIPT_INVALID:input");
  });

  it("rejects coherently rehashed absence, lifecycle, and semantic escalation", () => {
    const mutations = [
      (receipt: MutableReceipt) => { receipt.townRows[0].noPrimaryConclusion = "no_primary"; },
      (receipt: MutableReceipt) => { receipt.documents[0].nominationStatus = "nominated"; },
      (receipt: MutableReceipt) => { receipt.documents[0].houseOfficeContestRows = 1; },
      (receipt: MutableReceipt) => { receipt.review.status = "approved"; receipt.review.reviewer = "fabricated"; },
      (receipt: MutableReceipt) => { receipt.publicationEligible = true; },
      (receipt: MutableReceipt) => { receipt.summary.scoreEligibleRows = 1; },
      (receipt: MutableReceipt) => { receipt.unresolvedGates = []; },
      (receipt: MutableReceipt) => { receipt.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const input = load();
      const receipt = structuredClone(buildConnecticutFinalPrimaryBallotReceipt(input)) as unknown as MutableReceipt;
      mutate(receipt);
      expect(() => validateConnecticutFinalPrimaryBallotReceipt(rehash(receipt) as never, input)).toThrow("CT_FINAL_PRIMARY_BALLOT_RECEIPT_INVALID:semantic_or_hash_drift");
    }
  });
});
