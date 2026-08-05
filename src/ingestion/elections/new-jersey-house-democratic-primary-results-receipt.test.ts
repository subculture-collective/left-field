/* eslint-disable @typescript-eslint/no-explicit-any -- mutation test intentionally alters stored JSON */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewJerseyPrimaryResultsReceipt, validateNewJerseyPrimaryResultsReceipt } from "./new-jersey-house-democratic-primary-results-receipt";

const artifactPath = resolve("data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json");
const load = (): any => JSON.parse(readFileSync(artifactPath, "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const inputs = () => {
  const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: any[] }, byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  return ([2022, 2024, 2026] as const).map((year) => {
    const pdfEntry = byId.get(`nj-${year}-official-primary-results-us-house-pdf`), textEntry = byId.get(`nj-${year}-official-primary-results-us-house-text`);
    if (!pdfEntry?.retainedPath || !textEntry?.retainedPath) throw new Error(`test source missing: ${year}`);
    return { pdfEntry, pdfBytes: readFileSync(resolve(pdfEntry.retainedPath)), textEntry, textBytes: readFileSync(resolve(textEntry.retainedPath)) };
  });
};

describe("New Jersey Democratic House primary results receipt", () => {
  it("reproduces all three official result documents without making them score eligible", () => {
    const stored = validateNewJerseyPrimaryResultsReceipt(load()), rebuilt = buildNewJerseyPrimaryResultsReceipt(inputs());
    expect(rebuilt).toEqual(stored);
    expect(stored.summary).toEqual({ contests: 36, contests2022: 12, contests2024: 12, contests2026: 12, candidates: 83, candidateVotes: 1522601, sourceWinnerMarkedContests: 36, sourceWinnerUnmarkedContests: 0, sourceIncumbentMarkers: 25, contestSetSha256: "5f06d436f125403cf12a7aa0531a9d9e4348f9b4f7c8925ab86714072ec72946", evaluatorNumericValues: 0, scoreEligibleContests: 0 });
    expect(stored.contests.every((contest: any) => !contest.scoreEligible && Object.values(contest.evaluatorValues).every((value) => value === null))).toBe(true);
  });

  it("preserves marker-only continuations and wrapped names without inferring or retaining addresses", () => {
    const value = validateNewJerseyPrimaryResultsReceipt(load());
    for (const contestId of ["nj:2022:us-house:12:democratic", "nj:2024:us-house:12:democratic"]) { const contest = value.contests.find((row: any) => row.contestId === contestId); expect(contest?.winnerSourceCandidateName).toBe("BONNIE WATSON COLEMAN"); expect(contest?.candidates.find((candidate: any) => candidate.sourceCandidateName === "BONNIE WATSON COLEMAN")).toMatchObject({ winnerMarker: true, incumbentMarker: true }); }
    expect(value.contests.flatMap((contest: any) => contest.candidates.map((candidate: any) => candidate.sourceCandidateName))).toEqual(expect.arrayContaining(["ANE ROSEBOROUGH-EBERHARD", "VERLINA REYNOLDS-JACKSON"]));
    expect(value.contests.flatMap((contest: any) => contest.candidates).every((candidate: any) => Object.keys(candidate).sort().join(",") === "incumbentMarker,sourceCandidateName,votes,winnerMarker")).toBe(true);
  });

  it("rejects a fully rehashed invented source winner", () => {
    const value = load(), contest = value.contests.find((row: any) => row.contestId === "nj:2024:us-house:12:democratic"), invented = contest.candidates.find((candidate: any) => !candidate.winnerMarker);
    contest.candidates.forEach((candidate: any) => { candidate.winnerMarker = candidate === invented; }); contest.winnerSourceCandidateName = invented.sourceCandidateName;
    const { contestSha256: _contest, ...contestUnsigned } = contest; void _contest; contest.contestSha256 = digest("dsa-seats:nj-house-democratic-primary-result:v1\0", contestUnsigned);
    value.summary.contestSetSha256 = digest("dsa-seats:nj-house-democratic-primary-result-set:v1\0", value.contests.map(({ contestId, contestSha256 }: any) => ({ contestId, contestSha256 })));
    const { packageSha256: _package, ...unsigned } = value; void _package; value.packageSha256 = digest("dsa-seats:nj-house-democratic-primary-result-package:v1\0", unsigned);
    expect(() => validateNewJerseyPrimaryResultsReceipt(value)).toThrow();
  });
});
