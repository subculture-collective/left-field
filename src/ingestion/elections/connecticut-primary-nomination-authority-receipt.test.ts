import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildConnecticutNominationAuthorityReceipt, validateConnecticutNominationAuthorityReceipt } from "./connecticut-primary-nomination-authority-receipt";

const lock = () => JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8"));
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
// Deliberately mutable adversarial shape used to exercise fully rehashed invalid input.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutableReceipt = Record<string, any>;
const rehash = (receipt: MutableReceipt) => {
  receipt.observations.forEach((row: Record<string, unknown>) => { const unsignedRow = { ...row }; delete unsignedRow.rowSha256; row.rowSha256 = digest("dsa-seats:ct-nomination-authority-observation:v1\0", unsignedRow); });
  receipt.observationSetSha256 = digest("dsa-seats:ct-nomination-authority-observation-set:v1\0", receipt.observations.map(({ observationId, rowSha256 }: { observationId: string; rowSha256: string }) => ({ observationId, rowSha256 })));
  const unsigned = { ...receipt }; delete unsigned.packageSha256; delete unsigned.observationSetSha256;
  receipt.packageSha256 = digest("dsa-seats:ct-nomination-authority-package:v1\0", unsigned);
  return receipt;
};

describe("Connecticut primary nomination authority receipt", () => {
  it("retains ten Democratic endorsement observations without claiming nomination or approval", () => {
    const receipt = buildConnecticutNominationAuthorityReceipt(lock());
    expect(receipt.observations).toHaveLength(10);
    expect(receipt.observations.map((row) => [row.cycleYear, row.districtCode, row.candidateName])).toEqual([
      [2022,"01","John B. Larson"],[2022,"02","Joe Courtney"],[2022,"03","Rosa L. DeLauro"],[2022,"04","Jim Himes"],[2022,"05","Jahana Hayes"],
      [2024,"01","John B. Larson"],[2024,"02","Joe Courtney"],[2024,"03","Rosa L. DeLauro"],[2024,"04","Jim Himes"],[2024,"05","Jahana Hayes"],
    ]);
    expect(receipt.observations.every((row) => row.party === "Democratic" && row.formSelection === "endorsed" && row.nominationStatus === null && row.scoreEligible === false)).toBe(true);
    expect(receipt.observations.every((row) => row.sourcePage === 1 && row.sourceRecord === "democratic_endorsement_form")).toBe(true);
    expect(receipt.candidateListEvidence).toEqual(expect.objectContaining({ cycleYear: 2024, congressionalOfficeRows: 0, inference: "no_congressional_office_listed_in_statewide_democratic_primary_candidate_list" }));
    expect(JSON.stringify({ observations: receipt.observations, candidateListEvidence: receipt.candidateListEvidence })).not.toMatch(/address|street|zipCode|phone/i);
  });

  it("rejects lifecycle or nomination escalation even after re-entry", () => {
    const receipt = structuredClone(buildConnecticutNominationAuthorityReceipt(lock()));
    (receipt.review as { status: string }).status = "approved";
    expect(() => validateConnecticutNominationAuthorityReceipt(receipt as never)).toThrow("CT_NOMINATION_AUTHORITY_RECEIPT_INVALID");
  });

  it("rejects substituted source-lock URL, kind, or retention metadata", () => {
    for (const mutate of [
      (entry: Record<string, unknown>) => { entry.url = "https://example.invalid/replaced.pdf"; },
      (entry: Record<string, unknown>) => { entry.kind = "review_candidate"; },
      (entry: Record<string, unknown>) => { entry.retainedStatus = "retained"; entry.retainedPath = "data/source/leak.pdf"; },
    ]) {
      const changed = structuredClone(lock());
      const entry = changed.entries.find((candidate: { id: string }) => candidate.id === "ct-2024-cd04-endorsement-certificate-bundle");
      mutate(entry);
      expect(() => buildConnecticutNominationAuthorityReceipt(changed)).toThrow("CT_NOMINATION_AUTHORITY_RECEIPT_INVALID");
    }
  });

  it("rejects coherently rehashed observation and package-semantic substitutions", () => {
    const mutations = [
      (receipt: MutableReceipt) => { receipt.observations[0].observationId = "substituted"; },
      (receipt: MutableReceipt) => { receipt.observations[0].stateCode = "NY"; },
      (receipt: MutableReceipt) => { receipt.observations[0].office = "U.S. Senator"; },
      (receipt: MutableReceipt) => { receipt.observations[0].party = "Republican"; },
      (receipt: MutableReceipt) => { receipt.observations[0].transcriptionMethod = "inferred"; },
      (receipt: MutableReceipt) => { receipt.candidateListEvidence.congressionalOfficeRows = 1; },
      (receipt: MutableReceipt) => { receipt.summary.nominationConclusions = 1; },
      (receipt: MutableReceipt) => { receipt.limitations = []; },
      (receipt: MutableReceipt) => { receipt.unresolvedGates = []; },
    ];
    for (const mutate of mutations) {
      const receipt = structuredClone(buildConnecticutNominationAuthorityReceipt(lock())) as unknown as MutableReceipt;
      mutate(receipt);
      expect(() => validateConnecticutNominationAuthorityReceipt(rehash(receipt) as never)).toThrow("CT_NOMINATION_AUTHORITY_RECEIPT_INVALID");
    }
  });
});
