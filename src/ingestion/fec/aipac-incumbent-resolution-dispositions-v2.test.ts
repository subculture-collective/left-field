/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally alter sealed artifacts */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAipacIncumbentResolutionDispositionsV2, validateAipacIncumbentResolutionDispositionsV2 } from "./aipac-incumbent-resolution-dispositions-v2";
import { canonicalJson } from "./aipac-proposed-packages";

const path = resolve("data/metadata/aipac-incumbent-conflict-resolution-candidate-v1.json");
const load = () => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };

describe("AIPAC incumbent automatic resolution dispositions v2", () => {
  it("reduces six blanket blocks to one precise CA-31 2024 precedence decision", () => {
    const parent = load(), value = buildAipacIncumbentResolutionDispositionsV2({ parent: parent.value, parentFileSha256: parent.sha256 });
    expect(value.summary).toEqual({ inputCases: 6, fullyResolvedCases: 5, partiallyResolvedCases: 1, autoUsableHouseCycles: 9, autoNotApplicableHouseCycles: 2, pendingHouseCycles: 1, remainingMappingDecisions: 1, fabricatedReviewerApprovals: 0 });
    expect(value.remainingDecisionQueue[0]).toMatchObject({ seatCycleId: "seat_house_ca_31_current", cycleYear: 2024, defaultReversibleAssumption: "exclude_only_ca31_2024_relationship", resolution: null, reviewer: null, reviewedAt: null });
    expect(validateAipacIncumbentResolutionDispositionsV2(value)).toEqual(value);
  });

  it("keeps CA-31 2026 usable while excluding only its unclosed 2024 relationship", () => {
    const parent = load(), value = buildAipacIncumbentResolutionDispositionsV2({ parent: parent.value, parentFileSha256: parent.sha256 });
    const ca = value.dispositions.find((row) => row.seatCycleId === "seat_house_ca_31_current")!;
    expect(ca.cycleDispositions).toEqual([expect.objectContaining({ cycleYear: 2024, evaluatorUse: "excluded_pending_review" }), expect.objectContaining({ cycleYear: 2026, evaluatorUse: "reviewer_only_candidate" })]);
  });

  it("retains corrected aliases, a labeled DFL inference, and nonzero office transitions", () => {
    const parent = load(), value = buildAipacIncumbentResolutionDispositionsV2({ parent: parent.value, parentFileSha256: parent.sha256 });
    expect(value.dispositions.find((row) => row.seatCycleId === "seat_house_md_04_current")).toMatchObject({ sourceCandidateId: "H2MD04315", canonicalCandidateId: "H2MD04232", identityDisposition: "auto_corrected_native_id" });
    expect(value.dispositions.find((row) => row.seatCycleId === "seat_house_ny_04_current")).toMatchObject({ sourceCandidateId: "H4NY04158", canonicalCandidateId: "H2NY04244", identityDisposition: "auto_corrected_native_id" });
    expect(value.dispositions.find((row) => row.seatCycleId === "seat_house_mn_03_current")).toMatchObject({ rawPartyTreatment: "preserve_dfl_with_sourced_democratic_affiliation", identityDisposition: "auto_derived_party_alias" });
    for (const seat of ["seat_house_ma_06_current", "seat_house_nh_01_current"]) expect(value.dispositions.find((row) => row.seatCycleId === seat)?.cycleDispositions.find((cycle) => cycle.cycleYear === 2026)).toMatchObject({ disposition: "auto_verified_no_house_candidacy", committeeIds: [], evaluatorUse: "not_applicable_no_house_candidacy" });
  });

  it("fails closed on parent drift and a self-rehashed unsafe cycle disposition", () => {
    const parent = load();
    expect(() => buildAipacIncumbentResolutionDispositionsV2({ parent: parent.value, parentFileSha256: "0".repeat(64) })).toThrow("PARENT_FILE_HASH_MISMATCH");
    const value: any = buildAipacIncumbentResolutionDispositionsV2({ parent: parent.value, parentFileSha256: parent.sha256 });
    value.dispositions.find((row: any) => row.seatCycleId === "seat_house_ca_31_current").cycleDispositions[0].evaluatorUse = "reviewer_only_candidate";
    expect(() => validateAipacIncumbentResolutionDispositionsV2(value)).toThrow();
  });

  it("rejects moving the pending state after every affected hash is recomputed", () => {
    const parent = load(), value: any = buildAipacIncumbentResolutionDispositionsV2({ parent: parent.value, parentFileSha256: parent.sha256 });
    const ca = value.dispositions.find((row: any) => row.seatCycleId === "seat_house_ca_31_current"), nh = value.dispositions.find((row: any) => row.seatCycleId === "seat_house_nh_01_current");
    const pending = { ...ca.cycleDispositions[0] };
    ca.cycleDispositions[0] = { ...ca.cycleDispositions[1], cycleYear: 2024 };
    nh.cycleDispositions[1] = { ...pending, cycleYear: 2024, committeeIds: ["C00660464"] };
    for (const row of [ca, nh]) { const { dispositionSha256: _old, ...unsigned } = row; void _old; row.dispositionSha256 = createHash("sha256").update("dsa-seats:aipac-incumbent-resolution-disposition:v2\0").update(canonicalJson(unsigned)).digest("hex"); }
    value.derivation.dispositionSetSha256 = createHash("sha256").update("dsa-seats:aipac-incumbent-resolution-disposition-set:v2\0").update(canonicalJson(value.dispositions)).digest("hex");
    const { packageSha256: _package, ...unsigned } = value; void _package;
    value.packageSha256 = createHash("sha256").update("dsa-seats:aipac-incumbent-resolution-dispositions:v2\0").update(canonicalJson(unsigned)).digest("hex");
    expect(() => validateAipacIncumbentResolutionDispositionsV2(value)).toThrow("SEMANTICS_MISMATCH");
  });
});
