/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-receipt mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildConnecticutNominationStatutoryAuthorityReceipt,
  validateConnecticutNominationStatutoryAuthorityReceipt,
} from "./connecticut-nomination-statutory-authority-receipt";

const paths = {
  statute2021: "data/source/elections/primary-results/connecticut/statutes/2021-chapter-153.html",
  supplement2022: "data/source/elections/primary-results/connecticut/statutes/2022-chapter-153-supplement.html",
  statute2023: "data/source/elections/primary-results/connecticut/statutes/2023-chapter-153.html",
  supplement2024: "data/source/elections/primary-results/connecticut/statutes/2024-chapter-153-supplement.html",
  nominationReceipt: "data/metadata/connecticut-primary-nomination-authority-receipt-v1.json",
} as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const build = () => {
  const files = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path)]));
  return buildConnecticutNominationStatutoryAuthorityReceipt({
    statute2021: files.statute2021, statute2021Sha256: sha(files.statute2021),
    supplement2022: files.supplement2022, supplement2022Sha256: sha(files.supplement2022),
    statute2023: files.statute2023, statute2023Sha256: sha(files.statute2023),
    supplement2024: files.supplement2024, supplement2024Sha256: sha(files.supplement2024),
    nominationReceiptBytes: files.nominationReceipt,
    sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
  });
};
const rehash = (value: any) => {
  for (const row of value.cycles) { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:ct-nomination-statutory-authority-row:v1\0", unsigned); }
  value.cycleSetSha256 = digest("dsa-seats:ct-nomination-statutory-authority-cycle-set:v1\0", value.cycles);
  const unsigned = { ...value }; delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:ct-nomination-statutory-authority-package:v1\0", unsigned);
  return value;
};

describe("Connecticut nomination statutory-authority receipt", () => {
  it("binds cycle-specific section sources and timing without resolving trigger facts", () => {
    const value = build();
    expect(value.cycles.map((row) => [row.cycleYear, row.sectionSources, row.cancellationTiming])).toEqual([
      [2022, { "9-400": "ct-2021-chapter-153", "9-415": "ct-2021-chapter-153", "9-416": "ct-2021-chapter-153", "9-426": "ct-2021-chapter-153", "9-429": "ct-2021-chapter-153" }, "prior_to_opening_of_polls"],
      [2024, { "9-400": "ct-2023-chapter-153", "9-415": "ct-2023-chapter-153", "9-416": "ct-2023-chapter-153", "9-426": "ct-2024-chapter-153-supplement", "9-429": "ct-2024-chapter-153-supplement" }, "before_commencement_of_early_voting"],
    ]);
    expect(value.cycles.every((row) => Object.values(row.triggerFacts).every((fact) => fact === null) && row.primaryCancellationStatus === null && row.nominationConclusion === null && !row.approved && !row.scoreEligible)).toBe(true);
    expect(value.review).toEqual({ status: "proposed", reviewer: null, reviewedAt: null, resolution: null });
    expect(value.reviewerOnly).toBe(true); expect(value.publicationEligible).toBe(false);
    expect(validateConnecticutNominationStatutoryAuthorityReceipt(value)).toEqual(value);
  });

  it("rejects output source-lock lineage drift", () => {
    const lock = JSON.parse(readFileSync("data/source-lock.json", "utf8"));
    lock.entries.find((entry: { id: string }) => entry.id === "connecticut-nomination-statutory-authority-receipt-v1").parentIds = [];
    const original = readFileSync("data/source-lock.json", "utf8");
    const files = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path)]));
    expect(() => buildConnecticutNominationStatutoryAuthorityReceipt({ statute2021: files.statute2021, statute2021Sha256: sha(files.statute2021), supplement2022: files.supplement2022, supplement2022Sha256: sha(files.supplement2022), statute2023: files.statute2023, statute2023Sha256: sha(files.statute2023), supplement2024: files.supplement2024, supplement2024Sha256: sha(files.supplement2024), nominationReceiptBytes: files.nominationReceipt, sourceLock: lock })).toThrow("CT_NOMINATION_STATUTORY_AUTHORITY_RECEIPT_INVALID");
    expect(JSON.parse(original).version).toBe(1);
  });

  it.each([
    ["nominee inference", (value: any) => { value.cycles[0].nominationConclusion = "nominee"; }],
    ["no-primary inference", (value: any) => { value.cycles[0].primaryCancellationStatus = "no_primary"; }],
    ["invented filing fact", (value: any) => { value.cycles[0].triggerFacts.timelyConformingNonEndorsedCandidacyFiled = false; }],
    ["timing substitution", (value: any) => { value.cycles[1].cancellationTiming = "prior_to_opening_of_polls"; }],
    ["approval escalation", (value: any) => { value.cycles[0].approved = true; value.cycles[0].scoreEligible = true; }],
    ["nullable publication eligibility", (value: any) => { value.publicationEligible = null; }],
    ["metadata substitution", (value: any) => { value.version = 2; value.sourceCutoff = "2026-08-07"; value.originalPublishers = ["substituted"]; }],
    ["unknown top-level claim", (value: any) => { value.nominationConclusion = "certified_nominee"; }],
    ["missing trigger fact", (value: any) => { delete value.cycles[0].triggerFacts.replacementCandidacyFiled; }],
    ["unknown trigger fact", (value: any) => { value.cycles[0].triggerFacts.unreviewedFact = null; }],
    ["unknown cycle claim", (value: any) => { value.cycles[0].nominee = true; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const value = structuredClone(build()) as any; mutate(value); expect(() => validateConnecticutNominationStatutoryAuthorityReceipt(rehash(value))).toThrow("CT_NOMINATION_STATUTORY_AUTHORITY_RECEIPT_INVALID"); });

  it("rejects a mutated nomination parent paired with the original file hash", () => {
    const files = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path)]));
    const parent = JSON.parse(files.nominationReceipt.toString("utf8")); parent.review.status = "approved"; parent.observations[0].candidateName = "Substituted"; const changed = Buffer.from(`${JSON.stringify(parent, null, 2)}\n`);
    expect(() => buildConnecticutNominationStatutoryAuthorityReceipt({ statute2021: files.statute2021, statute2021Sha256: sha(files.statute2021), supplement2022: files.supplement2022, supplement2022Sha256: sha(files.supplement2022), statute2023: files.statute2023, statute2023Sha256: sha(files.statute2023), supplement2024: files.supplement2024, supplement2024Sha256: sha(files.supplement2024), nominationReceiptBytes: changed, sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")) })).toThrow("CT_NOMINATION_STATUTORY_AUTHORITY_RECEIPT_INVALID");
  });
});
