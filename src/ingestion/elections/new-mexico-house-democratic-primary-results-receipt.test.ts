import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewMexicoPrimaryResultsReceipt, validateNewMexicoPrimaryResultsReceipt, type NewMexicoPrimaryResultsReceipt, type NewMexicoSourceEntry } from "./new-mexico-house-democratic-primary-results-receipt";

const ids = new Set(["nm-2022-primary-federal-results-csv", "nm-2024-primary-federal-results-csv", "nm-2026-primary-federal-results-csv", "nm-2022-election-results-archive", "nm-2024-primary-certification-announcement", "nm-2026-primary-certification-announcement"]);
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewMexicoSourceEntry[] };
const inputs = () => lock.entries.filter((entry) => ids.has(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const proposalBytes = readFileSync(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
const proposal = { value: JSON.parse(proposalBytes.toString("utf8")) as unknown, bytes: proposalBytes };
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/new-mexico-house-democratic-primary-results-2022-2026-v1.json"), "utf8")) as NewMexicoPrimaryResultsReceipt;
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
function rehash(value: NewMexicoPrimaryResultsReceipt): NewMexicoPrimaryResultsReceipt {
  for (const contest of value.contests) { const unsigned = { ...contest } as Record<string, unknown>; delete unsigned.contestSha256; (contest as unknown as { contestSha256: string }).contestSha256 = hash("dsa-seats:nm-house-democratic-primary-result:v1\0", unsigned); }
  for (const row of value.targetObservations) { const contest = value.contests.find((item) => item.contestId === row.contestId)!; (row as unknown as { contestSha256: string }).contestSha256 = contest.contestSha256; const unsigned = { ...row } as Record<string, unknown>; delete unsigned.observationSha256; (row as unknown as { observationSha256: string }).observationSha256 = hash("dsa-seats:nm-house-primary-target-observation:v1\0", unsigned); }
  (value.summary as unknown as { contestSetSha256: string }).contestSetSha256 = hash("dsa-seats:nm-house-democratic-primary-result-set:v1\0", value.contests.map(({ contestId, contestSha256 }) => ({ contestId, contestSha256 })));
  (value.summary as unknown as { targetObservationSetSha256: string }).targetObservationSetSha256 = hash("dsa-seats:nm-house-primary-target-observation-set:v1\0", value.targetObservations.map(({ observationId, observationSha256 }) => ({ observationId, observationSha256 })));
  const unsigned = { ...value } as Record<string, unknown>; delete unsigned.packageSha256; (value as unknown as { packageSha256: string }).packageSha256 = hash("dsa-seats:nm-house-democratic-primary-result-package:v1\0", unsigned); return value;
}

describe("New Mexico Democratic House primary corpus", () => {
  it("retains all nine district-cycle contests with exact export closure", () => {
    const value = buildNewMexicoPrimaryResultsReceipt(inputs(), proposal, lock);
    expect(value.summary).toEqual(expect.objectContaining({ contests: 9, candidates: 10, candidateVotes: 441_199, targetObservations: 9 }));
    expect(value.cycles.map((cycle) => [cycle.cycleYear, cycle.federalExportRows, cycle.federalExportVotes])).toEqual([[2022, 8, 224_052], [2024, 19, 633_776], [2026, 10, 540_039]]);
    expect(value.contests.every((contest) => contest.sourceWinnerStatus === "not_marked_by_source" && contest.nominationConclusion === null)).toBe(true);
  });

  it("rejects source drift, topology drift, and semantic escalation", () => {
    const source = inputs(); const changed = Buffer.from(source[0]!.bytes); changed[0] ^= 1;
    expect(() => buildNewMexicoPrimaryResultsReceipt([{ ...source[0]!, bytes: changed }, ...source.slice(1)], proposal, lock)).toThrow("SOURCE_RECEIPT_INVALID");
    const changedLock = structuredClone(lock); const output = changedLock.entries.find((entry) => entry.id === "new-mexico-house-democratic-primary-results-2022-2026-v1")!; (output as unknown as { parentIds: string[] }).parentIds = [...output.parentIds].reverse();
    expect(() => buildNewMexicoPrimaryResultsReceipt(inputs(), proposal, changedLock)).toThrow("SOURCE_LOCK_MISMATCH");
    const promoted = structuredClone(stored()); (promoted.contests[0] as unknown as { scoreEligible: boolean }).scoreEligible = true;
    expect(() => validateNewMexicoPrimaryResultsReceipt(rehash(promoted))).toThrow("PACKAGE_INVARIANT_INVALID");
    const winner = structuredClone(stored()); (winner.contests[0] as unknown as { sourceWinnerStatus: string }).sourceWinnerStatus = "plurality_inferred"; (winner.contests[0] as unknown as { winnerSourceCandidateName: string | null }).winnerSourceCandidateName = winner.contests[0]!.candidates[0]!.sourceCandidateName;
    expect(() => validateNewMexicoPrimaryResultsReceipt(rehash(winner))).toThrow("PACKAGE_INVARIANT_INVALID");
    const identity = structuredClone(stored()); (identity.targetObservations[0] as unknown as { identityApproved: boolean }).identityApproved = true;
    expect(() => validateNewMexicoPrimaryResultsReceipt(rehash(identity))).toThrow("PACKAGE_INVARIANT_INVALID");
  });

  it("rebuilds the canonical checked-in artifact exactly", () => {
    expect(validateNewMexicoPrimaryResultsReceipt(buildNewMexicoPrimaryResultsReceipt(inputs(), proposal, lock))).toEqual(stored());
  });
});
import { createHash } from "node:crypto";
