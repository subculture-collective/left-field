import { createHash } from "node:crypto";

import type { PrototypeManifest, SnapshotId } from "@/domain/contracts";
import { prototypeManifestSchema } from "@/domain/contracts";

export interface ManifestIssue {
  readonly path: string;
  readonly message: string;
}

function canonicalize(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    const children = value.map((child) => canonicalize(child));
    return key === "profileSeatCycleIds"
      ? children
      : children.sort((left, right) => {
        const a = JSON.stringify(left); const b = JSON.stringify(right);
        return a < b ? -1 : a > b ? 1 : 0;
      });
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([childKey, child]) => [childKey, canonicalize(child, childKey)]),
    );
  }
  // Date-only values deliberately retain their calendar representation.  Every
  // accepted ISO instant, however, is canonicalized to PostgreSQL's UTC form.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return value;
}

export function computeCanonicalDataChecksum(
  manifest: Omit<PrototypeManifest, "canonicalDataChecksumSha256"> | PrototypeManifest,
): string {
  const { canonicalDataChecksumSha256: _ignored, release, ...rest } = manifest as PrototypeManifest;
  void _ignored;
  const { status: _status, publishedAt: _publishedAt, previousReleaseId: _previousReleaseId, ...releaseContent } = release;
  void _status; void _publishedAt; void _previousReleaseId;
  const content = { ...rest, release: releaseContent };
  return createHash("sha256").update(JSON.stringify(canonicalize(content))).digest("hex");
}

function duplicateIssues<T>(
  records: readonly T[],
  collection: string,
  getId: (record: T) => string,
): ManifestIssue[] {
  const seen = new Set<string>();
  const issues: ManifestIssue[] = [];

  records.forEach((record, index) => {
    const id = getId(record);
    if (seen.has(id)) {
      issues.push({ path: `${collection}.${index}.id`, message: `Duplicate identifier ${id}` });
    }
    seen.add(id);
  });

  return issues;
}

export function validatePrototypeManifest(input: unknown):
  | { readonly success: true; readonly data: PrototypeManifest }
  | { readonly success: false; readonly issues: readonly ManifestIssue[] } {
  const parsed = prototypeManifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const manifest = parsed.data;
  const issues: ManifestIssue[] = [];
  const releaseId = manifest.release.id;
  const sourceCutoffDate = new Date(manifest.release.sourceCutoff).toISOString().slice(0, 10);

  const collections: ReadonlyArray<
    readonly [string, readonly { id: string; releaseId: string }[]]
  > = [
    ["sources", manifest.sources],
    ["snapshots", manifest.snapshots],
    ["districtPlans", manifest.districtPlans],
    ["geometryArtifacts", manifest.geometryArtifacts],
    ["geographyVersions", manifest.geographyVersions],
    ["offices", manifest.offices],
    ["people", manifest.people],
    ["officeTerms", manifest.officeTerms],
    ["memberships", manifest.memberships],
    ["seatCycles", manifest.seatCycles],
    ["contests", manifest.contests],
    ["candidacies", manifest.candidacies],
    ["resultOptions", manifest.resultOptions],
    ["committees", manifest.committees],
    ["committeeRelationships", manifest.committeeRelationships],
    ["fecFilingSummaries", manifest.fecFilingSummaries],
  ];

  for (const [name, records] of collections) {
    issues.push(...duplicateIssues(records, name, (record) => record.id));
  }

  const sources = new Set(manifest.sources.map((record) => record.id));
  const snapshots = new Set<SnapshotId>(manifest.snapshots.map((record) => record.id));
  const plans = new Set(manifest.districtPlans.map((record) => record.id));
  const planRecords = new Map(manifest.districtPlans.map((record) => [record.id, record]));
  const artifacts = new Map(manifest.geometryArtifacts.map((record) => [record.id, record]));
  const geographies = new Map(manifest.geographyVersions.map((record) => [record.id, record]));
  const offices = new Map(manifest.offices.map((record) => [record.id, record]));
  const people = new Set(manifest.people.map((record) => record.id));
  const terms = new Map(manifest.officeTerms.map((record) => [record.id, record]));
  const cycleRecords = new Map(manifest.seatCycles.map((record) => [record.id, record]));
  const cycles = new Set(cycleRecords.keys());
  const contestRecords = new Map(manifest.contests.map((record) => [record.id, record]));
  const contests = new Set(contestRecords.keys());
  const candidacies = new Map(manifest.candidacies.map((record) => [record.id, record]));
  const resultOptions = new Map(manifest.resultOptions.map((record) => [record.id, record]));
  const committees = new Set(manifest.committees.map((record) => record.id));
  const filings = new Set(manifest.fecFilingSummaries.map((record) => record.id));

  const checkRelease = (records: readonly { releaseId: string }[], collection: string) => {
    records.forEach((record, index) => {
      if (record.releaseId !== releaseId) {
        issues.push({ path: `${collection}.${index}.releaseId`, message: "Record belongs to another release" });
      }
    });
  };

  const checkProvenance = (
    records: readonly { provenance: readonly { snapshotId: SnapshotId }[] }[],
    collection: string,
  ) => {
    records.forEach((record, index) => {
      record.provenance.forEach((reference, referenceIndex) => {
        if (!snapshots.has(reference.snapshotId)) {
          issues.push({
            path: `${collection}.${index}.provenance.${referenceIndex}.snapshotId`,
            message: "Unknown source snapshot",
          });
        }
      });
    });
  };

  const checkLineage = (
    records: readonly { lineage: { inputs: readonly { snapshotId: SnapshotId }[] } }[],
    collection: string,
  ) => {
    records.forEach((record, index) => {
      record.lineage.inputs.forEach((input, inputIndex) => {
        if (!snapshots.has(input.snapshotId)) {
          issues.push({
            path: `${collection}.${index}.lineage.inputs.${inputIndex}.snapshotId`,
            message: "Unknown source snapshot",
          });
        }
      });
    });
  };

  for (const [name, records] of collections) {
    checkRelease(records, name);
  }
  checkRelease(manifest.electionResults, "electionResults");
  checkRelease(manifest.acsObservations, "acsObservations");
  checkRelease(manifest.financeSummaries, "financeSummaries");

  const sourcedCollections: ReadonlyArray<
    readonly [string, readonly { provenance: readonly { snapshotId: SnapshotId }[] }[]]
  > = [
    ["districtPlans", manifest.districtPlans],
    ["geographyVersions", manifest.geographyVersions],
    ["offices", manifest.offices],
    ["people", manifest.people],
    ["officeTerms", manifest.officeTerms],
    ["memberships", manifest.memberships],
    ["seatCycles", manifest.seatCycles],
    ["contests", manifest.contests],
    ["candidacies", manifest.candidacies],
    ["resultOptions", manifest.resultOptions],
    ["committees", manifest.committees],
    ["committeeRelationships", manifest.committeeRelationships],
  ];
  for (const [name, records] of sourcedCollections) {
    checkProvenance(records, name);
  }
  checkLineage(manifest.contests, "contests");
  checkLineage(manifest.electionResults, "electionResults");
  checkLineage(manifest.acsObservations, "acsObservations");
  checkLineage(manifest.fecFilingSummaries, "fecFilingSummaries");

  if (computeCanonicalDataChecksum(manifest) !== manifest.canonicalDataChecksumSha256) {
    issues.push({ path: "canonicalDataChecksumSha256", message: "Canonical data checksum does not match manifest content" });
  }

  manifest.snapshots.forEach((snapshot, index) => {
    if (!sources.has(snapshot.sourceId)) {
      issues.push({ path: `snapshots.${index}.sourceId`, message: "Unknown source" });
    }
  });

  manifest.geometryArtifacts.forEach((artifact, index) => {
    if (!snapshots.has(artifact.snapshotId)) {
      issues.push({ path: `geometryArtifacts.${index}.snapshotId`, message: "Unknown geometry snapshot" });
    }
  });

  manifest.geographyVersions.forEach((geography, index) => {
    if (!artifacts.has(geography.geometryArtifactId)) {
      issues.push({ path: `geographyVersions.${index}.geometryArtifactId`, message: "Unknown geometry artifact" });
    }
    if (geography.kind === "house_district") {
      const plan = planRecords.get(geography.districtPlanId);
      if (!plans.has(geography.districtPlanId)) {
        issues.push({ path: `geographyVersions.${index}.districtPlanId`, message: "Unknown district plan" });
      } else if (plan && plan.jurisdictionStateCode !== geography.stateCode) {
        issues.push({ path: `geographyVersions.${index}.districtPlanId`, message: "Geography is outside district-plan jurisdiction" });
      }
    }
  });

  const geographyNaturalKeys = new Set<string>();
  manifest.geographyVersions.forEach((geography, index) => {
    const key = [geography.kind, geography.sourceGeoid, geography.vintage].join(":");
    if (geographyNaturalKeys.has(key)) issues.push({ path: `geographyVersions.${index}`, message: "Duplicate geography natural key" });
    geographyNaturalKeys.add(key);
  });

  manifest.offices.forEach((office, index) => {
    const invalidHouse = office.chamber === "house" && (office.kind === "senate" || office.districtCode === null || office.senateClass !== null);
    const invalidSenate = office.chamber === "senate" && (office.kind !== "senate" || office.districtCode !== null || office.senateClass === null);
    if (invalidHouse || invalidSenate) {
      issues.push({ path: `offices.${index}`, message: "Office fields are incompatible with chamber" });
    }
  });

  const officeNaturalKeys = new Set<string>();
  manifest.offices.forEach((office, index) => {
    const key = [office.chamber, office.stateCode, office.districtCode ?? "", office.senateClass ?? ""].join(":");
    if (officeNaturalKeys.has(key)) {
      issues.push({ path: `offices.${index}`, message: "Duplicate office natural key" });
    }
    officeNaturalKeys.add(key);
  });

  const bioguideIds = new Set<string>();
  manifest.people.forEach((person, index) => {
    if (person.bioguideId === null) return;
    if (bioguideIds.has(person.bioguideId)) {
      issues.push({ path: `people.${index}.bioguideId`, message: "Duplicate Bioguide ID" });
    }
    bioguideIds.add(person.bioguideId);
  });

  manifest.officeTerms.forEach((term, index) => {
    if (!offices.has(term.officeId)) {
      issues.push({ path: `officeTerms.${index}.officeId`, message: "Unknown office" });
    }
    if (term.startsAt >= term.endsAt) {
      issues.push({ path: `officeTerms.${index}`, message: "Office term must end after it starts" });
    }
  });
  for (let left = 0; left < manifest.officeTerms.length; left += 1) {
    for (let right = left + 1; right < manifest.officeTerms.length; right += 1) {
      const a = manifest.officeTerms[left];
      const b = manifest.officeTerms[right];
      if (a.officeId === b.officeId && a.startsAt < b.endsAt && b.startsAt < a.endsAt) {
        issues.push({ path: `officeTerms.${right}`, message: "Overlapping office terms" });
      }
    }
  }

  const termNaturalKeys = new Set<string>();
  manifest.officeTerms.forEach((term, index) => {
    const key = [term.officeId, term.startsAt, term.endsAt].join(":");
    if (termNaturalKeys.has(key)) issues.push({ path: `officeTerms.${index}`, message: "Duplicate office-term natural key" });
    termNaturalKeys.add(key);
  });

  manifest.memberships.forEach((membership, index) => {
    const term = terms.get(membership.officeTermId);
    if (!term) {
      issues.push({ path: `memberships.${index}.officeTermId`, message: "Unknown office term" });
    }
    if (!people.has(membership.personId)) {
      issues.push({ path: `memberships.${index}.personId`, message: "Unknown person" });
    }
    if (membership.endsAt !== null && membership.startsAt >= membership.endsAt) {
      issues.push({ path: `memberships.${index}`, message: "Membership must end after it starts" });
    }
    if (term && (membership.startsAt < term.startsAt || (membership.endsAt ?? term.endsAt) > term.endsAt)) {
      issues.push({ path: `memberships.${index}`, message: "Membership falls outside its office term" });
    }
  });
  for (let left = 0; left < manifest.memberships.length; left += 1) {
    for (let right = left + 1; right < manifest.memberships.length; right += 1) {
      const a = manifest.memberships[left];
      const b = manifest.memberships[right];
      const term = terms.get(a.officeTermId);
      const aEnd = a.endsAt ?? term?.endsAt ?? "9999-12-31";
      const bEnd = b.endsAt ?? term?.endsAt ?? "9999-12-31";
      if (a.officeTermId === b.officeTermId && a.startsAt < bEnd && b.startsAt < aEnd) {
        issues.push({ path: `memberships.${right}`, message: "Overlapping memberships" });
      }
    }
  }

  const cycleNaturalKeys = new Set<string>();
  manifest.seatCycles.forEach((cycle, index) => {
    const office = offices.get(cycle.officeId);
    const term = terms.get(cycle.officeTermId);
    const geography = geographies.get(cycle.geographyVersionId);
    if (!office) issues.push({ path: `seatCycles.${index}.officeId`, message: "Unknown office" });
    if (!term || term.officeId !== cycle.officeId) {
      issues.push({ path: `seatCycles.${index}.officeTermId`, message: "Unknown or incompatible office term" });
    }
    if (!geography) {
      issues.push({ path: `seatCycles.${index}.geographyVersionId`, message: "Unknown geography" });
    } else if (office && ((office.chamber === "house") !== (geography.kind === "house_district"))) {
      issues.push({ path: `seatCycles.${index}.geographyVersionId`, message: "Geography is incompatible with chamber" });
    } else if (office && office.stateCode !== geography.stateCode) {
      issues.push({ path: `seatCycles.${index}.geographyVersionId`, message: "Office and geography states do not match" });
    } else if (office && geography.kind === "house_district" && office.districtCode !== geography.districtCode) {
      issues.push({ path: `seatCycles.${index}.geographyVersionId`, message: "Office and geography districts do not match" });
    }
    const key = [cycle.officeId, cycle.cycleYear, cycle.electionKind].join(":");
    if (cycleNaturalKeys.has(key)) {
      issues.push({ path: `seatCycles.${index}`, message: "Duplicate seat-cycle natural key" });
    }
    cycleNaturalKeys.add(key);
    if (cycle.occupancy.asOf > sourceCutoffDate) {
      issues.push({ path: `seatCycles.${index}.occupancy.asOf`, message: "Occupancy date is after release source cutoff" });
    }
    if (term) {
      const activeMemberships = manifest.memberships.filter((membership) =>
        membership.officeTermId === cycle.officeTermId &&
        membership.startsAt <= cycle.occupancy.asOf &&
        (membership.endsAt === null || cycle.occupancy.asOf < membership.endsAt),
      );
      if (cycle.occupancy.status === "occupied" && activeMemberships.length !== 1) {
        issues.push({ path: `seatCycles.${index}.occupancy`, message: "Occupied seat must have exactly one active membership" });
      }
      if (cycle.occupancy.status === "vacant" && activeMemberships.length !== 0) {
        issues.push({ path: `seatCycles.${index}.occupancy`, message: "Vacant seat cannot have an active membership" });
      }
      if (cycle.occupancy.status !== "unknown" && (cycle.occupancy.asOf < term.startsAt || cycle.occupancy.asOf >= term.endsAt)) {
        issues.push({ path: `seatCycles.${index}.occupancy.asOf`, message: "Occupancy date falls outside office term" });
      }
    }
  });

  manifest.contests.forEach((contest, index) => {
    if (!cycles.has(contest.seatCycleId)) {
      issues.push({ path: `contests.${index}.seatCycleId`, message: "Unknown seat cycle" });
    }
    if (!geographies.has(contest.geographyVersionId)) {
      issues.push({ path: `contests.${index}.geographyVersionId`, message: "Unknown geography" });
    }
    const cycle = manifest.seatCycles.find((candidate) => candidate.id === contest.seatCycleId);
    if (cycle && cycle.geographyVersionId !== contest.geographyVersionId) {
      issues.push({ path: `contests.${index}.geographyVersionId`, message: "Contest and seat-cycle geography do not match" });
    }
    const results = manifest.electionResults.filter((result) => result.contestId === contest.id);
    if (contest.certificationStatus === "modeled") {
      if (contest.allocationMethod === "none" || contest.lineage.status !== "modeled") {
        issues.push({ path: `contests.${index}`, message: "Modeled contest requires modeled lineage and an allocation method" });
      }
      if (contest.allocationCoveragePercent.kind !== "value" || contest.allocationCoveragePercent.value <= 0) {
        issues.push({ path: `contests.${index}.allocationCoveragePercent`, message: "Modeled contest requires positive numeric allocation coverage" });
      }
      if (!results.some((result) => result.votes.kind === "value")) {
        issues.push({ path: `contests.${index}`, message: "Modeled contest requires at least one numeric result" });
      }
    } else if (contest.allocationMethod !== "none") {
      issues.push({ path: `contests.${index}.allocationMethod`, message: "Non-modeled contest cannot use an allocation method" });
    }
    if (contest.certificationStatus === "unavailable") {
      if (contest.reportingCompletenessPercent !== 0 || contest.denominatorVotes.kind !== "missing" || contest.denominatorVotes.reason !== "not_defensibly_modeled" || contest.allocationMethod !== "none" || contest.allocationCoveragePercent.kind !== "missing" || contest.allocationCoveragePercent.reason !== "not_applicable" || contest.lineage.status !== "reported" || !results.every((result) => result.votes.kind === "missing" && result.votes.reason === "not_defensibly_modeled")) {
        issues.push({ path: `contests.${index}`, message: "Unavailable contest must use the explicit unavailable facts and results" });
      }
    }
    if (contest.certificationStatus === "certified" && contest.lineage.status !== "certified") {
      issues.push({ path: `contests.${index}.lineage.status`, message: "Certified contest requires certified lineage" });
    }
    if (contest.allocationMethod === "none" && !(
      contest.allocationCoveragePercent.kind === "missing" &&
      contest.allocationCoveragePercent.reason === "not_applicable"
    )) {
      issues.push({ path: `contests.${index}.allocationCoveragePercent`, message: "Unallocated contest must mark allocation coverage not applicable" });
    }
  });

  const contestNaturalKeys = new Set<string>();
  manifest.contests.forEach((contest, index) => {
    const key = [contest.seatCycleId, contest.kind, contest.round, contest.electionDate].join(":");
    if (contestNaturalKeys.has(key)) issues.push({ path: `contests.${index}`, message: "Duplicate contest natural key" });
    contestNaturalKeys.add(key);
  });

  manifest.candidacies.forEach((candidacy, index) => {
    if (!contests.has(candidacy.contestId)) issues.push({ path: `candidacies.${index}.contestId`, message: "Unknown contest" });
    if (candidacy.personId !== null && !people.has(candidacy.personId)) issues.push({ path: `candidacies.${index}.personId`, message: "Unknown person" });
  });

  manifest.resultOptions.forEach((option, index) => {
    if (!contests.has(option.contestId)) issues.push({ path: `resultOptions.${index}.contestId`, message: "Unknown contest" });
    if (option.candidacyId !== null) {
      const candidacy = candidacies.get(option.candidacyId);
      if (!candidacy || candidacy.contestId !== option.contestId) {
        issues.push({ path: `resultOptions.${index}.candidacyId`, message: "Unknown or incompatible candidacy" });
      }
    }
  });

  manifest.electionResults.forEach((result, index) => {
    if (!contests.has(result.contestId)) {
      issues.push({ path: `electionResults.${index}.contestId`, message: "Unknown contest" });
    }
    const option = resultOptions.get(result.resultOptionId);
    if (!option || option.contestId !== result.contestId) {
      issues.push({ path: `electionResults.${index}.resultOptionId`, message: "Unknown or incompatible result option" });
    }
    const contest = manifest.contests.find((candidate) => candidate.id === result.contestId);
    if (contest && result.lineage.status !== contest.lineage.status) {
      issues.push({ path: `electionResults.${index}.lineage.status`, message: "Result and contest lineage statuses do not match" });
    }
  });

  const resultNaturalKeys = new Set<string>();
  manifest.electionResults.forEach((result, index) => {
    const key = `${result.contestId}:${result.resultOptionId}`;
    if (resultNaturalKeys.has(key)) issues.push({ path: `electionResults.${index}`, message: "Duplicate election-result natural key" });
    resultNaturalKeys.add(key);
  });

  manifest.contests.forEach((contest, contestIndex) => {
    if (contest.denominatorVotes.kind !== "value") return;
    const results = manifest.electionResults.filter((result) => result.contestId === contest.id);
    if (results.some((result) => result.votes.kind === "missing")) return;
    const resultTotal = results.reduce(
      (total, result) => total + (result.votes.kind === "value" ? result.votes.value : 0),
      0,
    );
    if (resultTotal > contest.denominatorVotes.value) {
      issues.push({ path: `contests.${contestIndex}.denominatorVotes`, message: "Result votes exceed contest denominator" });
    } else if (contest.reportingCompletenessPercent === 100 && resultTotal !== contest.denominatorVotes.value) {
      issues.push({ path: `contests.${contestIndex}.denominatorVotes`, message: "Complete contest results do not reconcile to denominator" });
    }
  });

  manifest.acsObservations.forEach((observation, index) => {
    if (!geographies.has(observation.geographyVersionId)) {
      issues.push({ path: `acsObservations.${index}.geographyVersionId`, message: "Unknown geography" });
    }
  });

  const acsNaturalKeys = new Set<string>();
  manifest.acsObservations.forEach((observation, index) => {
    const key = [observation.geographyVersionId, observation.variable, observation.surveyPeriod].join(":");
    if (acsNaturalKeys.has(key)) issues.push({ path: `acsObservations.${index}`, message: "Duplicate ACS natural key" });
    acsNaturalKeys.add(key);
  });

  const profileIds = new Set(manifest.profileSeatCycleIds);
  if (profileIds.size !== manifest.profileSeatCycleIds.length) {
    issues.push({ path: "profileSeatCycleIds", message: "Profile seat-cycle IDs must be unique" });
  }
  const representedStates = new Set<string>();
  const profileGeographyIds = new Set<string>();
  const profileVintages = new Set<string>();
  manifest.profileSeatCycleIds.forEach((profileId, index) => {
    const cycle = cycleRecords.get(profileId);
    const office = cycle ? offices.get(cycle.officeId) : undefined;
    if (!cycle || !office || office.chamber !== "house") {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile must reference a House seat cycle" });
      return;
    }
    representedStates.add(office.stateCode);
    if (profileGeographyIds.has(cycle.geographyVersionId)) {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile cycles must have unique House geographies" });
    }
    profileGeographyIds.add(cycle.geographyVersionId);
    const geography = geographies.get(cycle.geographyVersionId);
    if (geography) profileVintages.add(geography.vintage);
    const term = terms.get(cycle.officeTermId);
    if (term && !(term.startsAt <= sourceCutoffDate && sourceCutoffDate < term.endsAt)) {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile office term must cover the release source cutoff" });
    }
    if (!terms.has(cycle.officeTermId) || !geographies.has(cycle.geographyVersionId)) {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile lacks relational closure" });
    }
    const presidentialContests = manifest.contests.filter((contest) =>
      contest.seatCycleId === profileId &&
      contest.kind === "president_general" &&
      contest.electionDate.startsWith("2024-"),
    );
    if (presidentialContests.length !== 1 || !manifest.electionResults.some((result) => result.contestId === presidentialContests[0]?.id)) {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile requires one explicit 2024 presidential result" });
    }
    if (!manifest.acsObservations.some((observation) => observation.geographyVersionId === cycle.geographyVersionId)) {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile requires an ACS observation or explicit missing observation" });
    }
    if (manifest.financeSummaries.filter((summary) => summary.seatCycleId === profileId).length !== 1) {
      issues.push({ path: `profileSeatCycleIds.${index}`, message: "Profile requires exactly one finance summary" });
    }
  });

  if (profileVintages.size !== 1 || profileVintages.has("")) {
    issues.push({ path: "profileSeatCycleIds", message: "Profile House geographies must share one nonempty vintage" });
  }
  const [productVintage] = profileVintages;

  representedStates.forEach((stateCode) => {
    const stateGeographies = manifest.geographyVersions.filter((geography) =>
      geography.kind === "state" && geography.stateCode === stateCode && geography.vintage === productVintage,
    );
    if (stateGeographies.length !== 1) {
      issues.push({ path: "geographyVersions", message: `State ${stateCode} requires exactly one state geography at the product vintage` });
    }
    const activeSenateCandidates = manifest.seatCycles
      .map((cycle) => ({ cycle, office: offices.get(cycle.officeId), term: terms.get(cycle.officeTermId) }))
      .filter(({ office, term }) => office?.chamber === "senate" && office.stateCode === stateCode && term && term.startsAt <= sourceCutoffDate && sourceCutoffDate < term.endsAt);
    const officesInCandidates = new Set(activeSenateCandidates.map(({ cycle }) => cycle.officeId));
    const termsInCandidates = new Set(activeSenateCandidates.map(({ cycle }) => cycle.officeTermId));
    const senateClasses = new Set(activeSenateCandidates.map(({ office }) => office?.senateClass));
    if (activeSenateCandidates.length !== 2 || officesInCandidates.size !== 2 || termsInCandidates.size !== 2 || senateClasses.size !== 2 || senateClasses.has(null) || senateClasses.has(undefined)) {
      issues.push({ path: "seatCycles", message: `State ${stateCode} requires two distinct current Senate classes` });
    }
  });

  const financeSummaryCycles = new Set<string>();
  manifest.financeSummaries.forEach((summary, index) => {
    if (!cycles.has(summary.seatCycleId)) {
      issues.push({ path: `financeSummaries.${index}.seatCycleId`, message: "Unknown seat cycle" });
    }
    if (financeSummaryCycles.has(summary.seatCycleId)) {
      issues.push({ path: `financeSummaries.${index}`, message: "Duplicate seat finance summary" });
    }
    financeSummaryCycles.add(summary.seatCycleId);
    if (summary.kind === "value") {
      const filing = manifest.fecFilingSummaries.find((candidate) => candidate.id === summary.filingId);
      if (!filing) {
        issues.push({ path: `financeSummaries.${index}.filingId`, message: "Unknown finance filing" });
      } else {
        const isLeaf = !manifest.fecFilingSummaries.some((candidate) => candidate.amendsFilingId === filing.id);
        const highestAmendment = Math.max(
          ...manifest.fecFilingSummaries
            .filter((candidate) =>
              candidate.seatCycleId === filing.seatCycleId &&
              candidate.committeeId === filing.committeeId &&
              candidate.reportType === filing.reportType &&
              candidate.reportingPeriodStart === filing.reportingPeriodStart &&
              candidate.reportingPeriodEnd === filing.reportingPeriodEnd,
            )
            .map((candidate) => candidate.amendmentNumber),
        );
        if (
          filing.releaseId !== summary.releaseId ||
          filing.seatCycleId !== summary.seatCycleId ||
          filing.amendmentStatus === "superseded" ||
          !isLeaf ||
          filing.amendmentNumber !== highestAmendment
        ) {
          issues.push({ path: `financeSummaries.${index}.filingId`, message: "Finance summary must reference the canonical filing for its seat cycle" });
        }
      }
    }
    if (summary.kind === "missing") {
      summary.inputs.forEach((input, inputIndex) => {
        if (!snapshots.has(input.snapshotId)) issues.push({ path: `financeSummaries.${index}.inputs.${inputIndex}`, message: "Unknown source snapshot" });
      });
    }
  });

  const sourceCommitteeKeys = new Set<string>();
  manifest.committees.forEach((committee, index) => {
    if (sourceCommitteeKeys.has(committee.sourceCommitteeId)) issues.push({ path: `committees.${index}.sourceCommitteeId`, message: "Duplicate source committee ID" });
    sourceCommitteeKeys.add(committee.sourceCommitteeId);
  });

  manifest.committeeRelationships.forEach((relationship, index) => {
    if (!committees.has(relationship.committeeId)) issues.push({ path: `committeeRelationships.${index}.committeeId`, message: "Unknown committee" });
    if (!candidacies.has(relationship.candidacyId)) issues.push({ path: `committeeRelationships.${index}.candidacyId`, message: "Unknown candidacy" });
    if (relationship.effectiveTo !== null && relationship.effectiveFrom >= relationship.effectiveTo) {
      issues.push({ path: `committeeRelationships.${index}`, message: "Committee relationship must end after it starts" });
    }
  });

  manifest.fecFilingSummaries.forEach((filing, index) => {
    if (!cycles.has(filing.seatCycleId)) {
      issues.push({ path: `fecFilingSummaries.${index}.seatCycleId`, message: "Unknown seat cycle" });
    }
    if (filing.reportingPeriodStart > filing.reportingPeriodEnd) {
      issues.push({ path: `fecFilingSummaries.${index}`, message: "Reporting period is inverted" });
    }
    if (!committees.has(filing.committeeId)) {
      issues.push({ path: `fecFilingSummaries.${index}.committeeId`, message: "Unknown committee" });
    }
    const hasAttributableRelationship = manifest.committeeRelationships.some((relationship) => {
      if (relationship.committeeId !== filing.committeeId) return false;
      if (relationship.effectiveFrom > filing.reportingPeriodEnd) return false;
      if (relationship.effectiveTo !== null && relationship.effectiveTo <= filing.reportingPeriodStart) return false;
      const candidacy = candidacies.get(relationship.candidacyId);
      const contest = candidacy ? contestRecords.get(candidacy.contestId) : undefined;
      return contest?.seatCycleId === filing.seatCycleId;
    });
    if (!hasAttributableRelationship) {
      issues.push({ path: `fecFilingSummaries.${index}.committeeId`, message: "Committee is not attributable to filing seat cycle" });
    }
    if (filing.amendsFilingId !== null && !filings.has(filing.amendsFilingId)) {
      issues.push({ path: `fecFilingSummaries.${index}.amendsFilingId`, message: "Unknown amended filing" });
    }
  });

  const sourceFilingKeys = new Set<string>();
  const filingScopeSequenceKeys = new Set<string>();
  const amendmentChildren = new Map<string, number>();
  manifest.fecFilingSummaries.forEach((filing, index) => {
    if (sourceFilingKeys.has(filing.sourceFilingId)) issues.push({ path: `fecFilingSummaries.${index}.sourceFilingId`, message: "Duplicate source filing ID" });
    sourceFilingKeys.add(filing.sourceFilingId);
    const scopeSequenceKey = [
      filing.seatCycleId,
      filing.committeeId,
      filing.reportType,
      filing.reportingPeriodStart,
      filing.reportingPeriodEnd,
      filing.amendmentNumber,
    ].join(":");
    if (filingScopeSequenceKeys.has(scopeSequenceKey)) {
      issues.push({ path: `fecFilingSummaries.${index}`, message: "Duplicate filing amendment sequence within reporting scope" });
    }
    filingScopeSequenceKeys.add(scopeSequenceKey);
    if (filing.amendsFilingId === filing.id) issues.push({ path: `fecFilingSummaries.${index}.amendsFilingId`, message: "Filing cannot amend itself" });
    if (filing.amendmentNumber === 0 && filing.amendsFilingId !== null) issues.push({ path: `fecFilingSummaries.${index}`, message: "Original filing cannot amend another filing" });
    if (filing.amendmentNumber > 0 && filing.amendsFilingId === null) issues.push({ path: `fecFilingSummaries.${index}`, message: "Amendment must reference its predecessor" });
    if (filing.amendsFilingId !== null) {
      amendmentChildren.set(filing.amendsFilingId, (amendmentChildren.get(filing.amendsFilingId) ?? 0) + 1);
      const previous = manifest.fecFilingSummaries.find((candidate) => candidate.id === filing.amendsFilingId);
      if (previous && (
        previous.seatCycleId !== filing.seatCycleId ||
        previous.committeeId !== filing.committeeId ||
        previous.reportType !== filing.reportType ||
        previous.reportingPeriodStart !== filing.reportingPeriodStart ||
        previous.reportingPeriodEnd !== filing.reportingPeriodEnd ||
        previous.amendmentNumber + 1 !== filing.amendmentNumber ||
        previous.filedAt >= filing.filedAt
      )) {
        issues.push({ path: `fecFilingSummaries.${index}`, message: "Invalid amendment sequence or reporting scope" });
      }
    }
  });
  amendmentChildren.forEach((count, parentId) => {
    if (count > 1) issues.push({ path: "fecFilingSummaries", message: `Branching amendment chain at ${parentId}` });
  });
  manifest.fecFilingSummaries.forEach((filing, index) => {
    const hasChild = amendmentChildren.has(filing.id);
    if (hasChild && filing.amendmentStatus !== "superseded") {
      issues.push({ path: `fecFilingSummaries.${index}.amendmentStatus`, message: "Amended predecessor must be superseded" });
    }
    if (!hasChild && filing.amendmentStatus === "superseded") {
      issues.push({ path: `fecFilingSummaries.${index}.amendmentStatus`, message: "Leaf filing cannot be superseded" });
    }
    if (!hasChild && filing.amendmentNumber === 0 && filing.amendmentStatus !== "new") {
      issues.push({ path: `fecFilingSummaries.${index}.amendmentStatus`, message: "Original leaf filing must be new" });
    }
    if (!hasChild && filing.amendmentNumber > 0 && filing.amendmentStatus !== "amended") {
      issues.push({ path: `fecFilingSummaries.${index}.amendmentStatus`, message: "Amended leaf filing must be marked amended" });
    }
  });

  return issues.length === 0
    ? { success: true, data: manifest }
    : { success: false, issues };
}
