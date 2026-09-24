import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildIntakePackage, validateIntakePackage, type IntakeSpec } from "./package";
import { serializeSourceLock, type SourceLockEntry } from "./source-lock";
import { readDelimitedTable, tableInteger } from "./table";
import { sha } from "../shared";

const CSV = [
  "office,district,party,candidate,votes",
  "State Representative,7,DEM,Ada Lovelace,1200",
  "State Representative,7,DEM,Grace Hopper,800",
  "State Senator,3,DEM,Alan Turing,3000",
  'State Senator,3,DEM,"Write-in, Named (WI)",12',
].join("\n");

function fixtureRoot(csv = CSV): string {
  const root = mkdtempSync(join(tmpdir(), "intake-"));
  mkdirSync(join(root, "data/source/rapid/state-legislative/zz/2024"), { recursive: true });
  mkdirSync(join(root, "data/metadata"), { recursive: true });
  const path = "data/source/rapid/state-legislative/zz/2024/results.csv";
  const bytes = Buffer.from(csv);
  writeFileSync(join(root, path), bytes);
  const entry: SourceLockEntry = {
    id: "zz-2024-primary-results",
    url: "https://example.invalid/results.csv",
    retainedPath: path,
    retainedStatus: "retained",
    byteSize: bytes.length,
    sha256: sha(bytes),
    kind: "source",
    parentIds: [],
  };
  writeFileSync(join(root, "data/source-lock.json"), serializeSourceLock({ version: 1, entries: [entry] }));
  return root;
}

const spec: IntakeSpec = {
  id: "rapid-zz-state-legislative-primary-results-v1",
  version: 1,
  state: "ZZ",
  label: "Test state-legislative primary context",
  scope: "fixture",
  authority: "fixture_authority",
  limitations: ["fixture_only"],
  sources: [{ lockId: "zz-2024-primary-results", cycleYear: 2024, electionDate: "2024-05-07" }],
  parse(bytes, _source, { fail }) {
    const table = readDelimitedTable(bytes.toString("utf8"));
    const grouped = new Map<string, { office: string; districtCode: string; rawOfficeTitle: string; rawParty: string; candidates: { sourceName: string; candidacyKind: "named_candidate" | "named_write_in"; votes: number }[] }>();
    for (const row of table.records()) {
      const office = row.office === "State Senator" ? "state_senate" : row.office === "State Representative" ? "state_house" : fail("OFFICE_UNKNOWN");
      const districtCode = row.district!.padStart(3, "0");
      const key = `${office}:${districtCode}:${row.party}`;
      const group = grouped.get(key) ?? { office, districtCode, rawOfficeTitle: row.office!, rawParty: row.party!, candidates: [] };
      const writeIn = / \(WI\)$/.test(row.candidate!);
      group.candidates.push({ sourceName: row.candidate!.replace(/ \(WI\)$/, ""), candidacyKind: writeIn ? "named_write_in" : "named_candidate", votes: tableInteger(row.votes) });
      grouped.set(key, group);
    }
    return [...grouped.values()].map((group) => ({ officeLevel: "state_legislative" as const, jurisdiction: null, ...group }));
  },
};

describe("generic intake package", () => {
  it("derives cycle and package summaries from parsed contests", () => {
    const root = fixtureRoot();
    const value = buildIntakePackage(spec, root);
    expect(value.schema).toBe("rapid-local-context-intake-v1");
    expect(value.summary).toEqual({
      cycles: 1,
      contests: 2,
      candidateRows: 4,
      candidateVotes: 5012,
      contestedContests: 2,
      writeInCandidates: 1,
      contestsByOffice: { state_house: 1, state_senate: 1 },
      contestsByParty: { DEM: 2 },
      formulaEligibleContests: 0,
    });
    expect(value.cycles).toEqual([
      { cycleYear: 2024, electionDate: "2024-05-07", sourceLockIds: ["zz-2024-primary-results"], contests: 2, candidateRows: 4, candidateVotes: 5012 },
    ]);
    expect(value.contests.map((contest) => contest.contestId)).toEqual([
      "zz:test-state-legislative-primary-context:2024:state_house:007:dem",
      "zz:test-state-legislative-primary-context:2024:state_senate:003:dem",
    ]);
    expect(value.contests.every((contest) => contest.formulaEligible === false && contest.currentHolderIdentity === null && contest.sourceWinnerStatus === "not_marked_by_source")).toBe(true);
    expect(validateIntakePackage(spec, structuredClone(value), root)).toEqual(value);
  });

  it("is deterministic across builds", () => {
    const root = fixtureRoot();
    expect(buildIntakePackage(spec, root).packageSha256).toBe(buildIntakePackage(spec, root).packageSha256);
  });

  it("fails closure expectations loudly", () => {
    const root = fixtureRoot();
    const pinned: IntakeSpec = { ...spec, expect: { contests: 3 } };
    expect(() => buildIntakePackage(pinned, root)).toThrow("INTAKE_ZZ_CLOSURE_INVALID:package:contests:2!=3");
  });

  it("rejects source bytes that drift from the lock", () => {
    const root = fixtureRoot();
    writeFileSync(join(root, "data/source/rapid/state-legislative/zz/2024/results.csv"), `${CSV}\n`);
    expect(() => buildIntakePackage(spec, root)).toThrow("SOURCE_LOCK_BYTES_MISMATCH:zz-2024-primary-results");
  });

  it("rejects lifecycle escalation in a retained artifact", () => {
    const root = fixtureRoot();
    const value = structuredClone(buildIntakePackage(spec, root)) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateIntakePackage(spec, value, root)).toThrow("INTAKE_ZZ_PACKAGE_INVALID");
  });

  it("rejects duplicate contest ids and empty candidate lists", () => {
    const root = fixtureRoot();
    const duplicate: IntakeSpec = { ...spec, parse: (...args) => { const rows = spec.parse(...args); return [rows[0]!, rows[0]!]; } };
    expect(() => buildIntakePackage(duplicate, root)).toThrow("INTAKE_ZZ_CONTEST_ID_DUPLICATE");
    const empty: IntakeSpec = { ...spec, parse: (...args) => spec.parse(...args).map((row) => ({ ...row, candidates: [] })) };
    expect(() => buildIntakePackage(empty, root)).toThrow("INTAKE_ZZ_CANDIDATES_EMPTY");
  });
});
