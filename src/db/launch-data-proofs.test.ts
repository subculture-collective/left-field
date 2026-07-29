import { describe, expect, it } from "vitest";
import {
  LaunchProofError,
  canonicalSha256,
  electionPublicationProofSchema,
  fecV2PublicationProofSchema,
  financePublicationProofSchema,
  reviewSubjectSha256,
  signedReviewSchema,
  sourceCutoff,
  validateElectionEvidence,
  validateFinanceEvidence,
  verifyLaunchArtifacts,
  verifySignedReview,
  type ElectionEvidence,
  type ElectionPublicationProof,
  type FinanceEvidence,
  type FinancePublicationProof,
  type SubjectType,
} from "./launch-data-proofs";

const hash = "a".repeat(64);
const digestDomains: FinancePublicationProof["digestDomains"] = ["acs", "elections", "finance", "geography", "identity", "maps", "member"];
const financeProof: FinancePublicationProof = {
  proofId: "finance-proof",
  releaseId: "release",
  cutoff: "2026-07-18",
  summaryDispositions: 541,
  financeCoverageRows: 2164,
  terminalOutcomes: ["approved_finance", "vacancy"],
  unresolvedMappings: 0,
  paginationGaps: 0,
  amendmentGaps: 0,
  digestDomains,
};
const electionProof: ElectionPublicationProof = {
  proofId: "election-proof",
  releaseId: "release",
  cutoff: "2026-07-18",
  decisionRuns: 158,
  decisionYears: { 2020: 51, 2022: 56, 2024: 51 },
  digestDomains,
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };

function reviewed<T extends Record<string, unknown>>(type: SubjectType, reviewId: string, row: T) {
  const unsigned = { ...row, review_id: reviewId, subject_sha256: "" };
  return { ...unsigned, subject_sha256: reviewSubjectSha256(type, unsigned as never) };
}

function financeFixture(): Mutable<FinanceEvidence> {
  const evidence: Mutable<FinanceEvidence> = {
    profile: [], receipts: [], deletions: [], mappings: [], committees: [], pages: [],
    amendments: [], filings: [], vacancies: [], terminals: [], coverage: [],
  };
  evidence.receipts.push({
    release_id: "release", id: "receipt", raw_store_kind: "local", store_identity: "fixture", object_key: "finance/receipt.json", version_id: null, etag: null, acquisition_batch: "batch", source_url: "https://example.test/fec",
    request_sha256: hash, response_sha256: hash, byte_size: "1", retrieved_at: new Date("2026-07-18T00:00:00Z"),
    source_lock_entry_id: "lock", usage_status: "approved", retention: "sanitized", page_number: 1,
    cursor_in: null, cursor_out: null, terminal_page: 1,
  });
  evidence.deletions.push({ release_id: "release", receipt_id: "receipt", deleted_at: new Date("2026-07-18T00:01:00Z"), attestation_sha256: hash });
  for (let index = 0; index < 541; index += 1) {
    const seat = `seat-${index.toString().padStart(3, "0")}`;
    const vacant = index >= 537;
    evidence.profile.push({ seat_cycle_id: seat, occupancy_status: vacant ? "vacant" : "occupied" });
    evidence.terminals.push(reviewed("finance_terminal", `terminal-${seat}`, { release_id: "release", seat_cycle_id: seat, outcome: vacant ? "vacancy" : "approved_finance" }));
    for (const kind of ["summary", "category", "organization", "outside_spending"]) {
      evidence.coverage.push(reviewed("finance_closure", `coverage-${seat}-${kind}`, { release_id: "release", seat_cycle_id: seat, kind, status: kind === "summary" ? "complete" : "not_collected" }));
    }
    if (vacant) {
      evidence.vacancies.push(reviewed("vacancy", `vacancy-${seat}`, { release_id: "release", seat_cycle_id: seat, receipt_id: "receipt" }));
      continue;
    }
    evidence.mappings.push(reviewed("fec_mapping", `mapping-${seat}`, { release_id: "release", seat_cycle_id: seat, fec_candidate_id: `candidate-${seat}`, campaign_cycle: 2026, candidacy_key: `candidacy-${seat}`, outcome: "mapped", receipt_id: "receipt" }));
    evidence.committees.push(reviewed("committee_mapping", `committee-${seat}`, { release_id: "release", seat_cycle_id: seat, fec_candidate_id: `candidate-${seat}`, committee_id: `committee-${seat}`, designation: "P", effective_from: "2025-01-01", effective_to: null, receipt_id: "receipt" }));
    evidence.pages.push(reviewed("finance_page_closure", `page-${seat}`, { release_id: "release", seat_cycle_id: seat, acquisition_batch: "batch", expected_terminal_page: 1, actual_terminal_page: 1, expected_cursor_out: null, actual_cursor_out: null }));
    const filingId = `filing-${seat}`;
    evidence.amendments.push(reviewed("finance_amendment_closure", `amendment-${seat}`, { release_id: "release", seat_cycle_id: seat, committee_id: `committee-${seat}`, report_type: "Q1", reporting_period_start: "2026-01-01", reporting_period_end: "2026-03-31", expected_terminal_amendment: 0, actual_terminal_amendment: 0, expected_filing_id: filingId, actual_filing_id: filingId }));
    evidence.filings.push({ release_id: "release", id: filingId, seat_cycle_id: seat, committee_id: `committee-${seat}`, report_type: "Q1", reporting_period_start: "2026-01-01", reporting_period_end: "2026-03-31", source_filing_id: filingId, amendment_number: 0, amendment_status: "new", amends_filing_id: null, filed_at: new Date("2026-07-18T00:00:00Z") });
  }
  return evidence;
}

function electionFixture(): Mutable<ElectionEvidence> {
  const evidence: Mutable<ElectionEvidence> = { decisions: [], receipts: [], inventory: [], authority: [], envelopes: [], resultTotals: [], lineage: [], geometry: [] };
  evidence.receipts.push({ release_id: "release", id: "receipt", raw_store_kind: "local", store_identity: "fixture", object_key: "elections/receipt.json", version_id: null, etag: null, authority: "official", source_url: "https://example.test/elections", sha256: hash, byte_size: "1", version: "v1", retrieved_at: new Date("2026-07-18T00:00:00Z"), source_lock_entry_id: "lock", usage_status: "approved" });
  for (const [year, count] of [[2020, 51], [2022, 56], [2024, 51]] as const) {
    for (let index = 0; index < count; index += 1) {
      const decisionId = `decision-${year}-${index}`;
      const jurisdiction = `J${index.toString().padStart(2, "0")}`;
      evidence.decisions.push({ release_id: "release", id: decisionId, jurisdiction_code: jurisdiction, election_year: year, status: "approved" });
      const contestCount = year === 2022 && index === 0 ? 2 : 1;
      for (let contest = 0; contest < contestCount; contest += 1) {
        const inventoryId = `inventory-${year}-${index}-${contest}`;
        const envelopeId = `envelope-${year}-${index}-${contest}`;
        const authorityId = `authority-${year}-${index}-${contest}`;
        evidence.inventory.push(reviewed("election_decision", `inventory-review-${inventoryId}`, { release_id: "release", id: inventoryId, election_year: year, jurisdiction_code: jurisdiction, contest_key: `contest-${year}-${index}-${contest}`, contest_kind: year === 2022 ? "house_general" : "presidential_general", boundary_kind: "original", inventory_receipt_id: "receipt", decision_run_id: decisionId }));
        evidence.authority.push({ release_id: "release", id: authorityId, receipt_id: "receipt", jurisdiction_code: jurisdiction, election_year: year, certification_status: "certified", certified_at: new Date("2026-07-18T00:00:00Z") });
        evidence.envelopes.push(reviewed("election_result", `envelope-review-${envelopeId}`, { release_id: "release", id: envelopeId, inventory_row_id: inventoryId, authority_artifact_id: authorityId, disposition: "approved", first_failed_gate: null, denominator_votes: "1", reporting_completeness_percent: "100", certification_status: "certified", reconciliation_status: "reconciled", allocation_method: "none", allocation_coverage_percent: "100" }));
        evidence.resultTotals.push({ release_id: "release", envelope_id: envelopeId, option_key: "winner", votes: "1" });
        evidence.lineage.push({ release_id: "release", envelope_id: envelopeId, receipt_id: "receipt" });
      }
    }
  }
  return evidence;
}

const expectCode = (work: () => unknown, code: LaunchProofError["code"] = "LAUNCH_PROOF_COUNTS") => {
  expect(work).toThrow(expect.objectContaining({ code }));
};

describe("launch data proof contracts", () => {
  it("requires complete fixed proof claims", () => {
    expect(financePublicationProofSchema.safeParse(financeProof).success).toBe(true);
    expect(financePublicationProofSchema.safeParse({ ...financeProof, summaryDispositions: 540 }).success).toBe(false);
    expect(electionPublicationProofSchema.safeParse(electionProof).success).toBe(true);
    expect(electionPublicationProofSchema.safeParse({ ...electionProof, decisionRuns: 157 }).success).toBe(false);
    expect(fecV2PublicationProofSchema.safeParse({ proofId: "v2", releaseId: "destination", planSha256: hash }).success).toBe(true);
    expect(fecV2PublicationProofSchema.safeParse({ proofId: "v2", releaseId: "destination", planSha256: "draft" }).success).toBe(false);
  });
  it("hashes canonical object keys and signed subjects", () => {
    expect(canonicalSha256({ b: 2, a: 1 })).toBe(canonicalSha256({ a: 1, b: 2 }));
    const row = reviewed("vacancy", "review", { release_id: "release", seat_cycle_id: "seat", receipt_id: "receipt" });
    expect(reviewSubjectSha256("vacancy", row)).toBe(row.subject_sha256);
    expect(reviewSubjectSha256("vacancy", { ...row, receipt_id: "tampered" })).not.toBe(row.subject_sha256);
  });
  it.each([["2026-07-18", "2026-07-18"], ["2026-07-18T19:00:00-05:00", "2026-07-19"], [new Date("2026-07-18T12:00:00Z"), "2026-07-18"], ["bad", undefined]])("normalizes cutoff %s", (value, expected) => expect(sourceCutoff(value)).toBe(expected));
});

describe("finance launch evidence", () => {
  it("accepts exact 541/537/4/2164 closure", () => expect(() => validateFinanceEvidence(financeFixture(), financeProof)).not.toThrow());
  it("rejects a missing deletion attestation", () => { const fixture = financeFixture(); fixture.deletions = []; expectCode(() => validateFinanceEvidence(fixture, financeProof), "LAUNCH_PROOF_MISSING"); });
  it("rejects a restricted receipt", () => { const fixture = financeFixture(); fixture.receipts[0] = { ...fixture.receipts[0]!, usage_status: "restricted" }; expectCode(() => validateFinanceEvidence(fixture, financeProof), "LAUNCH_PROOF_MISSING"); });
  it("rejects duplicate terminal keys", () => { const fixture = financeFixture(); fixture.terminals.push(fixture.terminals[0]!); expectCode(() => validateFinanceEvidence(fixture, financeProof)); });
  it("rejects any page gap", () => { const fixture = financeFixture(); const row = fixture.pages[0]!; fixture.pages[0] = reviewed("finance_page_closure", row.review_id, { ...row, review_id: undefined, subject_sha256: undefined, actual_terminal_page: 2 } as never); expectCode(() => validateFinanceEvidence(fixture, financeProof)); });
  it("rejects committee identity mismatch", () => { const fixture = financeFixture(); const row = fixture.committees[0]!; fixture.committees[0] = reviewed("committee_mapping", row.review_id, { ...row, review_id: undefined, subject_sha256: undefined, fec_candidate_id: "wrong" } as never); expectCode(() => validateFinanceEvidence(fixture, financeProof)); });
  it("rejects a claimed terminal-outcome mismatch", () => expectCode(() => validateFinanceEvidence(financeFixture(), { ...financeProof, terminalOutcomes: ["approved_finance"] })));
});

describe("election launch evidence", () => {
  it("accepts 158 decisions and a larger exact 2022 contest inventory", () => expect(() => validateElectionEvidence(electionFixture())).not.toThrow());
  it("rejects a restricted receipt", () => { const fixture = electionFixture(); fixture.receipts[0] = { ...fixture.receipts[0]!, usage_status: "restricted" }; expectCode(() => validateElectionEvidence(fixture), "LAUNCH_PROOF_MISSING"); });
  it("rejects duplicate envelopes", () => { const fixture = electionFixture(); fixture.envelopes.push({ ...fixture.envelopes[0]!, id: "duplicate" }); expectCode(() => validateElectionEvidence(fixture)); });
  it("sums integer votes without IEEE-754 loss", () => { const fixture = electionFixture(); const envelope = fixture.envelopes[0]!; fixture.resultTotals[0] = { ...fixture.resultTotals[0]!, votes: "9007199254740993" }; fixture.envelopes[0] = reviewed("election_result", envelope.review_id, { ...envelope, review_id: undefined, subject_sha256: undefined, denominator_votes: "9007199254740993" } as never); expect(() => validateElectionEvidence(fixture)).not.toThrow(); });
  it("rejects authority mismatch", () => { const fixture = electionFixture(); fixture.authority[0] = { ...fixture.authority[0]!, jurisdiction_code: "wrong" }; expectCode(() => validateElectionEvidence(fixture)); });
  it("allows an unavailable modeled contest to stop before geometry", () => { const fixture = electionFixture(); const inventory = fixture.inventory[0]!; fixture.inventory[0] = reviewed("election_decision", inventory.review_id, { ...inventory, review_id: undefined, subject_sha256: undefined, boundary_kind: "modeled_current" } as never); const envelope = fixture.envelopes[0]!; fixture.envelopes[0] = reviewed("election_result", envelope.review_id, { ...envelope, review_id: undefined, subject_sha256: undefined, disposition: "unavailable", first_failed_gate: "authority", denominator_votes: null, reporting_completeness_percent: null, certification_status: null, reconciliation_status: null, allocation_method: null, allocation_coverage_percent: null } as never); fixture.resultTotals = fixture.resultTotals.filter(row => row.envelope_id !== envelope.id); fixture.lineage = fixture.lineage.filter(row => row.envelope_id !== envelope.id); expect(() => validateElectionEvidence(fixture)).not.toThrow(); });
  it("requires geometry for an approved modeled contest", () => { const fixture = electionFixture(); const inventory = fixture.inventory[0]!; fixture.inventory[0] = reviewed("election_decision", inventory.review_id, { ...inventory, review_id: undefined, subject_sha256: undefined, boundary_kind: "modeled_current" } as never); expectCode(() => validateElectionEvidence(fixture)); });
});

describe("review signatures", () => {
  it("fails closed for malformed, wrong-role, and revoked reviews", async () => {
    expect(signedReviewSchema.safeParse({}).success).toBe(false);
    const review = { reviewId: "review", subjectType: "fec_mapping" as const, subjectSha256: hash, reviewerId: "reviewer", signedAt: "2026-07-22T00:00:00.000Z", signature: "sig", keyId: "key" };
    const key = { publicKey: "key", publicKeyFingerprint: "0".repeat(64), reviewerRole: "release_approver" as const, allowedSubjectTypes: ["fec_mapping" as const], validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: null, revokedAt: null };
    await expect(verifySignedReview(review, { resolve: async () => key }, { verify: async () => true })).rejects.toMatchObject({ code: "LAUNCH_PROOF_SIGNATURE" });
    await expect(verifySignedReview(review, { resolve: async () => ({ ...key, reviewerRole: "data_reviewer" as const, revokedAt: new Date() }) }, { verify: async () => true })).rejects.toMatchObject({ code: "LAUNCH_PROOF_SIGNATURE" });
  });
});

describe("launch artifact replay", () => {
  it("replays immutable bytes and rejects a checksum mismatch", async () => {
    const bytes = new TextEncoder().encode("x");
    const responseSha256 = canonicalSha256("not-the-object-hash");
    const actualSha256 = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    const receipt = { ...financeFixture().receipts[0]!, response_sha256: actualSha256 };
    const stores = { resolve: async () => ({ read: async () => bytes }) };
    await expect(verifyLaunchArtifacts([receipt], true, stores)).resolves.toBeUndefined();
    await expect(verifyLaunchArtifacts([{ ...receipt, response_sha256: responseSha256 }], true, stores)).rejects.toMatchObject({ code: "LAUNCH_PROOF_HASH" });
  });
});
