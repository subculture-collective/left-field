import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

import { canonicalManifest, canonicalManifestChecksum } from "@/data/canonical-manifest";
import { computeCanonicalDataChecksum, validatePrototypeManifest } from "@/domain/validate-manifest";

describe("Phase 0 canonical manifest", () => {
  it("has exactly the prescribed profile order and a valid checksum", () => {
    expect(canonicalManifest.profileSeatCycleIds).toEqual([
      "seat_house_ak_al_2024_regular", "seat_house_al_02_2024_regular", "seat_house_al_05_2024_regular", "seat_house_al_07_2024_regular", "seat_house_az_01_2024_regular", "seat_house_az_06_2024_regular", "seat_house_az_07_2024_regular", "seat_house_fl_06_2024_regular", "seat_house_fl_12_2024_regular", "seat_house_fl_26_2024_regular",
    ]);
    expect(validatePrototypeManifest(canonicalManifest).success).toBe(true);
    expect(canonicalManifestChecksum).toBe(computeCanonicalDataChecksum(canonicalManifest));
  });

  it("uses the exact official source snapshots and preserves current officeholders", () => {
    expect(canonicalManifest.snapshots.every((snapshot) => !snapshot.sourceUrl.includes("example.com"))).toBe(true);
    expect(canonicalManifest.release).toMatchObject({ sourceCutoff: "2026-07-01T00:00:00Z", createdAt: "2026-07-18T00:00:00Z" });
    expect(canonicalManifest.snapshots.filter((snapshot) => ["snap_house_roster", "snap_clerk_2024", "snap_acs_2024_b01003", "snap_acs_2024_b19013", "snap_acs_2024_b01002", "snap_fec_1922049", "snap_fec_1946508", "snap_fec_1973409"].includes(snapshot.id)).map(({ id, sourceUrl, checksumSha256, retrievedAt }) => [id, sourceUrl, checksumSha256, retrievedAt])).toEqual([
      ["snap_house_roster", "https://clerk.house.gov/xml/lists/MemberData.xml", "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b", "2026-07-18T00:00:00Z"],
      ["snap_clerk_2024", "https://clerk.house.gov/member_info/electionInfo/2024/statistics2024.pdf", "d4ba800fc17135b616ae556c92861080ab962d95916ace34b546c5aac824aec4", "2026-07-18T00:00:00Z"],
      ["snap_acs_2024_b01003", "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01003.dat", "38d1a992bb058d184009b10b9b34987279aee575e4323165cfb5706c69b6ca90", "2026-07-18T00:00:00Z"],
      ["snap_acs_2024_b19013", "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b19013.dat", "b25a176b0e6c339b6f3a2a0d3d8446bf06f5f080b4395993ec9a8313efb1c229", "2026-07-18T00:00:00Z"],
      ["snap_acs_2024_b01002", "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01002.dat", "04784637609550868d9da7321e7a947b34e0a10b654dbf6d344599f97f8de7f8", "2026-07-18T00:00:00Z"],
      ["snap_fec_1922049", "https://docquery.fec.gov/csv/049/1922049.csv", "0d9a0179ccbcddb95d69db65784a056a9c0eb8ad3bad9495052933d8cc6734d4", "2026-07-18T00:00:00Z"],
      ["snap_fec_1946508", "https://docquery.fec.gov/csv/508/1946508.csv", "4f4e948a9cc961c619d8e80b76377a60f18ad2dd12ed7cffd187c592e4800b2f", "2026-07-18T00:00:00Z"],
      ["snap_fec_1973409", "https://docquery.fec.gov/csv/409/1973409.csv", "2536d97136c25d262f3d24a4207a708bfd0887b4ecbeea10c1f613276a8cc2bc", "2026-07-18T00:00:00Z"],
    ]);
    expect(canonicalManifest.people.filter((person) => ["B001323", "G000606", "F000484", "M001244"].includes(person.bioguideId ?? "")).map((person) => person.displayName)).toEqual(["Nicholas J. Begich III", "Adelita S. Grijalva", "Randy Fine", "Ashley Moody"]);
  });

  it("maps ACS names and never emits Alaska's negative MOE sentinel", () => {
    const alaska = canonicalManifest.acsObservations.filter((row) => row.geographyVersionId === "geo_house_ak_al");
    expect(alaska.map((row) => row.variable)).toEqual(["B01003_001E", "B19013_001E"]);
    expect(alaska[0]?.estimate).toEqual({ kind: "value", value: 735706 });
    expect(alaska[0]?.marginOfError).toEqual({ kind: "missing", reason: "not_applicable" });
  });

  it("uses table-specific ACS and filing-specific FEC provenance", () => {
    expect(canonicalManifest.acsObservations.map((row) => row.lineage.inputs[0]?.snapshotId)).toEqual(expect.arrayContaining(["snap_acs_2024_b01003", "snap_acs_2024_b19013"]));
    expect(canonicalManifest.acsObservations.some((row) => row.variable === "B01002_001E" || row.label === "Median age")).toBe(false);
    expect(canonicalManifest.fecFilingSummaries.map((filing) => filing.lineage.inputs[0]?.snapshotId)).toEqual(["snap_fec_1920279", "snap_fec_1922049", "snap_fec_1946508", "snap_fec_1973409"]);
    expect(canonicalManifest.committees[0]).toMatchObject({ name: "Committee to Elect Shomari Figures for Congress", provenance: [{ snapshotId: "snap_fec_1973409" }] });
  });

  it("marks Clerk House results certified with correct regular-cycle incumbency", () => {
    const houseContests = canonicalManifest.contests.filter((contest) => contest.kind === "house_general" && contest.electionDate === "2024-11-05");
    expect(houseContests.every((contest) => contest.certificationStatus === "certified" && contest.lineage.status === "certified")).toBe(true);
    expect(canonicalManifest.seatCycles.filter((cycle) => cycle.id.endsWith("_2024_regular")).every((cycle) => cycle.incumbencyStatus === "unknown")).toBe(true);
  });

  it("uses each senator's next regular election year without assuming candidacy", () => {
    expect(canonicalManifest.seatCycles.filter((cycle) => cycle.id.startsWith("seat_senate_")).map((cycle) => [cycle.id, cycle.cycleYear, cycle.incumbencyStatus])).toEqual([
      ["seat_senate_ak_2_current", 2026, "unknown"], ["seat_senate_ak_3_current", 2028, "unknown"], ["seat_senate_al_2_current", 2026, "unknown"], ["seat_senate_al_3_current", 2028, "unknown"], ["seat_senate_az_1_current", 2030, "unknown"], ["seat_senate_az_3_current", 2028, "unknown"], ["seat_senate_fl_1_current", 2030, "unknown"], ["seat_senate_fl_3_current", 2028, "unknown"],
    ]);
  });

  it("refuses unavailable district presidential totals rather than inventing zeros", () => {
    const contest = canonicalManifest.contests.find((row) => row.id === "contest_president_al_02")!;
    expect(contest).toMatchObject({ certificationStatus: "unavailable", reportingCompletenessPercent: 0, denominatorVotes: { kind: "missing", reason: "not_defensibly_modeled" }, allocationMethod: "none", lineage: { status: "reported" } });
    expect(canonicalManifest.electionResults.find((row) => row.contestId === contest.id)?.votes).toEqual({ kind: "missing", reason: "not_defensibly_modeled" });
    expect(canonicalManifest.seatCycles.find((cycle) => cycle.id === "seat_house_al_02_2026_regular")?.occupancy).toEqual({ status: "unknown", asOf: "2026-07-01" });
  });

  it("attributes the district-presidential refusal to its editorial derivation, not Clerk", () => {
    const unavailable = canonicalManifest.contests.filter((contest) => contest.kind === "president_general" && contest.certificationStatus === "unavailable");
    expect(unavailable).toHaveLength(9);
    for (const contest of unavailable) {
      expect(contest.provenance).toEqual([{ snapshotId: "snap_district_presidential_policy", role: "original_publisher" }]);
      expect(contest.lineage.inputs).toEqual([
        { snapshotId: "snap_clerk_2024", role: "derived_input" },
        { snapshotId: "snap_district_presidential_policy", role: "original_publisher" },
      ]);
      expect(canonicalManifest.electionResults.filter((result) => result.contestId === contest.id).every((result) => JSON.stringify(result.lineage.inputs) === JSON.stringify(contest.lineage.inputs))).toBe(true);
    }
  });

  it("records the Figures FEC amendment chain without unaudited summary values", () => {
    expect(canonicalManifest.fecFilingSummaries.map((filing) => [filing.sourceFilingId, filing.amendmentNumber, filing.amendmentStatus, filing.amendsFilingId])).toEqual([["1920279", 0, "superseded", null], ["1922049", 1, "superseded", "fec_1920279"], ["1946508", 2, "superseded", "fec_1922049"], ["1973409", 3, "amended", "fec_1946508"]]);
    expect(canonicalManifest.fecFilingSummaries.every((filing) => filing.cashOnHand.kind === "missing" && filing.cashOnHand.reason === "not_collected")).toBe(true);
  });

  it("uses restricted, sanitized FEC provenance only for the 2026 Figures cycle", () => {
    expect(canonicalManifest.snapshots.filter((snapshot) => snapshot.id.startsWith("snap_fec_")).every((snapshot) => snapshot.usageStatus === "restricted" && snapshot.license.includes("52 U.S.C. §30111(a)(4)"))).toBe(true);
    expect(canonicalManifest.fecFilingSummaries.every((filing) => filing.seatCycleId === "seat_house_al_02_2026_regular")).toBe(true);
    expect(canonicalManifest.financeSummaries.every((summary) => summary.kind === "missing" && summary.inputs[0]?.snapshotId === "snap_collection_status")).toBe(true);
    expect(execFileSync("node", ["scripts/verify-source-lock.mjs"], { encoding: "utf8" })).toContain("Verified");
  });

  it("attributes future AL-02 scheduling to editorial scope and FEC only as a derived filing input", () => {
    const editorialLicense = "Project-authored internal prototype metadata; approved for private prototype use.";
    expect(canonicalManifest.snapshots.filter((snapshot) => ["snap_collection_status", "snap_district_presidential_policy", "snap_pre_election_al_02_2026_scope"].includes(snapshot.id)).every((snapshot) => snapshot.usageStatus === "approved" && snapshot.license === editorialLicense)).toBe(true);
    const term = canonicalManifest.officeTerms.find((row) => row.id === "term_house_al_02_2027")!;
    const cycle = canonicalManifest.seatCycles.find((row) => row.id === "seat_house_al_02_2026_regular")!;
    const contest = canonicalManifest.contests.find((row) => row.id === "contest_house_al_02_2026_general")!;
    expect([term.provenance, cycle.provenance, contest.provenance]).toEqual([[{ snapshotId: "snap_pre_election_al_02_2026_scope", role: "original_publisher" }], [{ snapshotId: "snap_pre_election_al_02_2026_scope", role: "original_publisher" }], [{ snapshotId: "snap_pre_election_al_02_2026_scope", role: "original_publisher" }]]);
    expect(contest.lineage.inputs).toEqual([{ snapshotId: "snap_pre_election_al_02_2026_scope", role: "original_publisher" }, { snapshotId: "snap_fec_1973409", role: "derived_input" }]);
  });

  it("keeps ACS compatibility and Senate term provenance explicit", () => {
    expect(canonicalManifest.acsObservations.every((row) => row.lineage.inputs.some((input) => input.snapshotId === "snap_acs_2024_geography" && input.role === "derived_input"))).toBe(true);
    expect(canonicalManifest.officeTerms.filter((term) => term.id.startsWith("term_senate_")).every((term) => term.provenance[0]?.snapshotId.startsWith("snap_senate_class_"))).toBe(true);
    expect(canonicalManifest.memberships.find((membership) => membership.id === "member_senate_fl_3")).toMatchObject({ startsAt: "2025-01-21", provenance: [{ snapshotId: "snap_senate_new_senators" }] });
  });

  it("models named write-ins as candidate options without creating people", () => {
    for (const label of ["Luis Pozzolo", "Richard Paul Dembinsky"]) {
      const option = canonicalManifest.resultOptions.find((row) => row.label === label)!;
      const candidacy = canonicalManifest.candidacies.find((row) => row.id === option.candidacyId)!;
      expect(option.optionKind).toBe("candidate");
      expect(candidacy).toMatchObject({ status: "write_in", personId: null });
    }
    expect(canonicalManifest.resultOptions.find((row) => row.label === "John Wayne Howe")).toMatchObject({ party: "other" });
  });
});
