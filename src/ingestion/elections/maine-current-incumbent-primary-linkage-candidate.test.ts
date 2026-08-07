/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildMainePrimaryIdentityCandidate, validateMainePrimaryIdentityCandidate } from "./maine-current-incumbent-primary-linkage-candidate";

const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { bytes, value: JSON.parse(bytes.toString("utf8")), hash: sha(bytes) }; };
const stored = () => json("data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json").value as any;
const input = () => {
  const roster = json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), receipt = json("data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json"), house = readFileSync("data/source/identity/house-member-data.xml"), congress = readFileSync("data/source/identity/congress-legislators-current-20260804.json");
  return { roster: roster.value, rosterFileSha256: roster.hash, proposal: proposal.value, proposalFileSha256: proposal.hash, receipt: receipt.value, receiptFileSha256: receipt.hash, houseXml: house.toString("utf8"), houseFileSha256: sha(house), congressJson: congress.toString("utf8"), congressFileSha256: sha(congress), sourceLock: json("data/source-lock.json").value };
};
function rehash(value: any) {
  for (const row of value.observations) { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:me-primary-identity-row:v1\0", unsigned); }
  value.observationSetSha256 = digest("dsa-seats:me-primary-identity-row-set:v1\0", value.observations);
  const unsigned = { ...value }; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:me-primary-identity-candidate:v1\0", unsigned); return value;
}

describe("Maine current-incumbent primary linkage candidate", () => {
  it("partitions six observations into two exact links, three documented derived links, and Golden's 2026 nonappearance", () => {
    const value = validateMainePrimaryIdentityCandidate(buildMainePrimaryIdentityCandidate(input()));
    expect(value.summary).toEqual({ targetSeats: 2, observations: 6, proposedIdentityLinks: 5, exactNameObservations: 2, derivedNameRelationships: 3, currentIncumbentNonappearances: 1, linkedCandidateVotes: 266_438, sourceContestCandidates: 9, sourceContestWorkbookCandidateVotes: 345_162, directIdentifierBridges: 0, sourceWinnerMarkers: 1, linkedSourceWinnerMarkers: 0, automaticallyApprovedRows: 0, geographyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0, evaluatorNumericValues: 0 });
    expect(value.observations.map((row) => [row.observationId, row.identityStatus, row.matchMethod, row.sourceCandidateName, row.sourceCandidateVotes])).toEqual([
      ["me:identity:2022:01", "proposed_identity_link", "derived_source_middle_initial_not_in_official_house_name_reordered_same_district", "Pingree, Chellie M.", 43_007],
      ["me:identity:2022:02", "proposed_identity_link", "derived_source_full_middle_name_matches_congress_legislators_middle_name_reordered_same_district", "Golden, Jared Forrest", 25_684],
      ["me:identity:2024:01", "proposed_identity_link", "exact_normalized_reordered_official_house_name_same_district", "Pingree, Chellie", 46_307],
      ["me:identity:2024:02", "proposed_identity_link", "derived_source_full_middle_name_matches_congress_legislators_middle_name_reordered_same_district", "Golden, Jared Forrest", 23_183],
      ["me:identity:2026:01", "proposed_identity_link", "exact_normalized_reordered_official_house_name_same_district", "PINGREE, CHELLIE", 128_257],
      ["me:identity:2026:02", "current_incumbent_not_observed_in_source_candidate_set", "no_unique_candidate_match_current_incumbent_not_observed", null, null],
    ]);
  });

  it("preserves Dunlap's result-only RCV winner boundary without linking or selecting Golden", () => {
    const row = buildMainePrimaryIdentityCandidate(input()).observations.at(-1)!;
    expect(row).toEqual(expect.objectContaining({ bioguideId: "G000592", sourceCandidateCount: 4, sourceContestWorkbookCandidateVotes: 78_724, sourceContestBlankVotes: 4_756, sourceContestTotalBallotsCast: 83_480, sourceWinnerStatus: "explicit_rcv_summary_winner", winnerSourceCandidateName: "Dunlap, Matthew G.", sourceWinnerIdentityTreatment: "retained_source_winner_is_not_current_incumbent_identity_evidence", relationshipDisposition: "not_linked_current_incumbent_not_observed", selectionStatus: "not_selected_current_incumbent_not_observed", identityApproved: false, scoreEligible: false }));
    expect(row.sourceCandidateName).toBeNull(); expect(row.sourceCandidateVotes).toBeNull(); expect(row.winnerConclusion).toBeNull(); expect(row.nominationConclusion).toBeNull();
  });

  it("rejects lock drift and fully rehashed nonappearance, winner, approval, and lifecycle escalation", () => {
    const changed = input(), lock = changed.sourceLock as any; lock.entries.find((entry: any) => entry.id === "maine-house-democratic-primary-results-2022-2026-v1").parentIds.reverse();
    expect(() => buildMainePrimaryIdentityCandidate(changed)).toThrow("SOURCE_LOCK_MISMATCH");
    for (const mutate of [
      (value: any) => { value.observations[5].sourceCandidateName = "Dunlap, Matthew G."; value.observations[5].sourceCandidateVotes = 35_924; },
      (value: any) => { value.observations[5].identityStatus = "proposed_identity_link"; value.observations[5].relationshipDisposition = "proposed_identity_link_pending_documented_review"; },
      (value: any) => { value.observations[0].sourceWinnerStatus = "single_candidate_inferred"; },
      (value: any) => { value.observations[0].identityApproved = true; },
      (value: any) => { value.publicationEligible = true; },
      (value: any) => { value.review.reviewer = "fabricated-reviewer"; value.review.reviewedAt = "2026-08-07T10:00:00Z"; value.review.resolution = "approved"; },
      (value: any) => { value.decisionSupport.reviewerResolution = "approved"; },
      (value: any) => { value.inputs.receipt.packageSha256 = "0".repeat(64); },
      (value: any) => { value.observations[0].sourceContestWorkbookCandidateVotes += 1; },
      (value: any) => { value.observations[5].winnerSourceCandidateName = null; value.observations[5].sourceWinnerStatus = "not_marked_by_source"; },
      (value: any) => { value.observations[5].rcvFirstChoiceNamedCandidateDelta = 0; },
      (value: any) => { value.observations[0].evaluatorValues.fabricatedScore = 1; },
      (value: any) => { value.observations[0].unknownField = "fabricated"; },
      (value: any) => { value.unknownField = "fabricated"; },
      (value: any) => { value.observations[0].bioguideId = "G000592"; value.observations[0].targetSeatId = "seat_house_me_02_current"; },
      (value: any) => { value.observations[0].sourceContestId = "me:2022:regular:us-house:02:democratic"; value.observations[0].parentTargetObservationId = "me:target:2022:02"; },
      (value: any) => { value.observations[0].rcvFirstChoiceNamedCandidateDelta = 81; },
      (value: any) => { value.observations[0].rationaleCodes = ["fuzzy_match_fabricated"]; },
      (value: any) => { value.decisionSupport.proposedIdentityObservationIds = value.decisionSupport.affectedObservationIds; value.decisionSupport.nonappearanceObservationIds = []; },
      (value: any) => { value.methodology.nonappearanceTreatment = "infer_retirement"; },
      (value: any) => { value.observations[0].evaluatorUse = "allowed"; },
      (value: any) => { value.observations[0].evaluatorValues.fabricatedScore = null; },
      (value: any) => { value.decisionSupport.unknownField = null; },
    ]) { const value = stored(); mutate(value); expect(() => validateMainePrimaryIdentityCandidate(rehash(value))).toThrow("PACKAGE_INVARIANT_INVALID"); }
  });

  it("rebuilds the canonical source-locked artifact exactly", () => {
    expect(validateMainePrimaryIdentityCandidate(buildMainePrimaryIdentityCandidate(input()))).toEqual(stored());
  });
});
