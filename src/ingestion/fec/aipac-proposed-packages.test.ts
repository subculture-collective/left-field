import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { attachAndValidatePackageSha256, officialBulkUrl, packageSha256, validateProposedPackage } from "./aipac-proposed-packages";

describe("AIPAC proposed package contract", () => {
  it("hashes canonical keys deterministically", () => {
    expect(packageSha256({ b: 2, a: 1 })).toBe(packageSha256({ a: 1, b: 2 }));
  });

  it("rejects unknown package shapes and hash mutations", () => {
    expect(() => validateProposedPackage(attachAndValidatePackageSha256({ schema: "unknown" }))).toThrow("AIPAC_PROPOSED_PACKAGE_INVALID");
  });

  it.each([
    ["cn22.zip", "2022"],
    ["cm24.zip", "2024"],
    ["ccl26.zip", "2026"],
  ])("derives the official FEC bulk cycle for %s", (file, cycle) => {
    expect(officialBulkUrl(file)).toBe(`https://www.fec.gov/files/bulk-downloads/${cycle}/${file}`);
  });

  it("rejects an unrecognized FEC bulk filename", () => {
    expect(() => officialBulkUrl("ccl-current.zip")).toThrow("FEC_BULK_FILE_NAME_INVALID");
  });

  it.each([
    "aipac-candidate-seat-mappings-proposal-v1.json",
    "aipac-evidence-closure-proposal-v1.json",
    "org-classification-aipac-network-proposal-v1.json",
  ])("validates the generated proposed reviewer package %s", (file) => {
    const value = JSON.parse(readFileSync(resolve("data/metadata", file), "utf8"));
    expect(() => validateProposedPackage(value)).not.toThrow();
    expect(value.review).toEqual({ status: "proposed", reviewer: null, reviewedAt: null });
  });
});
