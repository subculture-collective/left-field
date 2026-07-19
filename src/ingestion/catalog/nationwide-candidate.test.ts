import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { compileBoundaryBundle } from "@/db/manifest";
import type { PrototypeManifest } from "@/domain/contracts";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";
import { LocalRawObjectStore } from "@/ingestion/core/raw-object-store";
import { createIdentityAdapter, decodeIdentityEnvelope, encodeIdentityEnvelope, type IdentityEnvelopeV1 } from "@/ingestion/identity/adapter";
import type { HouseSeat } from "@/ingestion/identity/house";
import { parseSenateRoster, parseSenateServiceStartsArtifact, type SenateSeat } from "@/ingestion/identity/senate";
import { compileNationwideCandidate, type NationwideCandidateOptions } from "./nationwide-candidate";

const root = resolve(process.cwd(), "data");
const bytes = (path: string) => readFile(resolve(root, path));
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const houseCounts: Record<string, number> = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };

const houseUniverse: readonly HouseSeat[] = [
  ...Object.entries(houseCounts).flatMap(([stateCode, count]) => Array.from({ length: count }, (_, index) => ({ stateCode, districtCode: (count === 1 ? "AL" : String(index + 1).padStart(2, "0")) as HouseSeat["districtCode"], kind: "representative" as const, termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" }))),
  ...(["DC", "AS", "GU", "MP", "VI"] as const).map(stateCode => ({ stateCode, districtCode: "AL" as const, kind: "delegate" as const, termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" })),
  { stateCode: "PR", districtCode: "AL", kind: "resident_commissioner", termStartsAt: "2025-01-03", termEndsAt: "2029-01-03" },
];

async function currentIdentityEnvelope(house: Uint8Array, senate: Uint8Array, senateServiceStarts: Uint8Array): Promise<IdentityEnvelopeV1> {
  const serviceStarts = parseSenateServiceStartsArtifact(senateServiceStarts.toString());
  const senateUniverse: readonly SenateSeat[] = parseSenateRoster(senate.toString(), serviceStarts).records.map(row => ({ stateCode: row.office.stateCode, senateClass: row.office.senateClass!, ...(row.office.senateClass === 1 ? { termStartsAt: "2025-01-03", termEndsAt: "2031-01-03" } : row.office.senateClass === 2 ? { termStartsAt: "2021-01-03", termEndsAt: "2027-01-03" } : { termStartsAt: "2023-01-03", termEndsAt: "2029-01-03" }) }));
  const storeRoot = await mkdtemp(join(tmpdir(), "nationwide-candidate-"));
  try {
    const adapter = createIdentityAdapter({ rawStore: new LocalRawObjectStore(storeRoot), snapshotId: "snap_identity" as never, upstreamRelease: "2025", parserVersion: "identity-v1", releaseCutoff: "2026-07-18", sourceLockSha256: "a".repeat(64), house: { bytes: house, url: "https://clerk.house.gov/xml/lists/MemberData.xml", checksumSha256: sha(house), lockId: "house-xml" }, senate: { bytes: senate, url: "https://www.senate.gov/general/contact_information/senators_cfm.xml", checksumSha256: sha(senate), lockId: "senate-xml" }, senateServiceStarts: { bytes: senateServiceStarts, url: "urn:dsa-seats:senate-service-starts:v1", checksumSha256: sha(senateServiceStarts), lockId: "senate-service-starts" }, houseUniverse, senateUniverse, senatePolicy: { noSenateJurisdictions: new Set(["DC", "PR", "AS", "GU", "MP", "VI"]) } });
    for await (const raw of adapter.extract({ releaseId: "rel_nationwide_candidate_test" as never, sourceId: "src_identity" as never, cutoff: new Date("2026-07-18T00:00:00Z") })) return decodeIdentityEnvelope(encodeIdentityEnvelope(raw.value));
    throw new Error("IDENTITY_ENVELOPE_NOT_EXTRACTED");
  } finally {
    await rm(storeRoot, { recursive: true, force: true });
  }
}

describe("nationwide candidate compiler", () => {
  it("compiles the retained official nationwide corpus deterministically", async () => {
    const [houseBytes, senateBytes, senateServiceStartsBytes, cd119Bytes, statesBytes, manifestBytes] = await Promise.all([
      bytes("source/identity/house-member-data.xml"), bytes("source/identity/senate-members.xml"), bytes("source/identity/senate-service-starts.json"),
      bytes("geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871/tiger2025-national-cd119.geojson"),
      bytes("geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871/tiger2025-national-states.geojson"),
      bytes("geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871/tiger2025-national-manifest.json"),
    ]);
    const identity = await currentIdentityEnvelope(houseBytes, senateBytes, senateServiceStartsBytes);
    const options = { release: { id: "rel_nationwide_candidate_test", label: "Nationwide candidate test", sourceCutoff: "2026-07-18T00:00:00Z", createdAt: "2026-07-18T00:00:00Z" }, identity, tiger: { schemaVersion: 1 as const, parserVersion: "tiger-v1", upstreamRelease: "2025", sourceUrl: "urn:dsa-seats:tiger2025:national-manifest", manifest: JSON.parse(manifestBytes.toString()), components: { cd119: { base64: Buffer.from(cd119Bytes).toString("base64"), byteLength: cd119Bytes.byteLength, checksumSha256: sha(cd119Bytes), objectKey: "data/geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871/tiger2025-national-cd119.geojson" }, states: { base64: Buffer.from(statesBytes).toString("base64"), byteLength: statesBytes.byteLength, checksumSha256: sha(statesBytes), objectKey: "data/geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871/tiger2025-national-states.geojson" } } }, sources: [{ id: "src_identity", releaseId: "rel_nationwide_candidate_test", name: "Identity", authority: "official", homepageUrl: "https://clerk.house.gov/" }, { id: "src_tiger", releaseId: "rel_nationwide_candidate_test", name: "Tiger", authority: "official", homepageUrl: "https://www.census.gov/" }], snapshots: [{ id: "snap_identity", releaseId: "rel_nationwide_candidate_test", sourceId: "src_identity", sourceUrl: "https://clerk.house.gov/", publishedAt: null, retrievedAt: "2026-07-18T00:00:00Z", checksumSha256: "a".repeat(64), parserVersion: "identity-v1", license: "public domain", usageStatus: "approved" }, { id: "snap_tiger", releaseId: "rel_nationwide_candidate_test", sourceId: "src_tiger", sourceUrl: "https://www.census.gov/", publishedAt: null, retrievedAt: "2026-07-18T00:00:00Z", checksumSha256: "b".repeat(64), parserVersion: "tiger-v1", license: "public domain", usageStatus: "approved" }] };
    const compilerOptions = { ...options, sourceLockSha256: "a".repeat(64), snapshots: options.snapshots as unknown as NationwideCandidateOptions["snapshots"], sources: [{ ...options.sources[0], name: "identity", authority: "derived" as const }, { ...options.sources[1], name: "tiger", authority: "derived" as const }] as const, tiger: { ...options.tiger, sourceLockSha256: "a".repeat(64), lockIds: { cd119: "geo-national-cd119" as const, states: "geo-national-states" as const, manifest: "geo-national-manifest" as const, bundle: "geo-national-bundle" as const }, components: { cd119: { storeKind: "local" as const, storeLocator: "test", objectKey: `tiger/${sha(cd119Bytes)}.geojson`, sha256: sha(cd119Bytes), byteSize: cd119Bytes.byteLength }, states: { storeKind: "local" as const, storeLocator: "test", objectKey: `tiger/${sha(statesBytes)}.geojson`, sha256: sha(statesBytes), byteSize: statesBytes.byteLength } } }, tigerComponents: { cd119Bytes, statesBytes } };
    const compiled = compileNationwideCandidate(compilerOptions); const repeated = compileNationwideCandidate(compilerOptions);
    expect(compiled.manifest).toEqual(repeated.manifest);
    expect(compiled.manifest.jurisdictions).toHaveLength(56); expect(compiled.manifest.districtPlans).toHaveLength(56);
    expect(compiled.manifest.geographyVersions).toHaveLength(497); expect(compiled.manifest.catalogSeatCycleIds).toHaveLength(541);
    expect(compiled.manifest.people).toHaveLength(537); expect(compiled.manifest.memberships).toHaveLength(537);
    expect(compiled.manifest.seatCycles.filter((row) => row.occupancy.status === "vacant")).toHaveLength(4);
    expect(compiled.manifest.offices.filter((row) => row.chamber === "senate" && ["DC", "PR", "AS", "GU", "MP", "VI"].includes(row.stateCode))).toHaveLength(0);
    expect(compiled.manifest.sources).toEqual([{ id: "src_identity", releaseId: "rel_nationwide_candidate_test", name: "identity", authority: "derived", homepageUrl: "https://clerk.house.gov/" }, { id: "src_tiger", releaseId: "rel_nationwide_candidate_test", name: "tiger", authority: "derived", homepageUrl: "https://www.census.gov/" }]);
    const prOffice = compiled.manifest.offices.find((row) => row.kind === "resident_commissioner")!;
    const prTerm = compiled.manifest.officeTerms.find((row) => row.officeId === prOffice.id)!;
    expect(prTerm).toMatchObject({ id: "term_house_pr_al_2029_01_03", startsAt: "2025-01-03", endsAt: "2029-01-03" });
    expect(compiled.manifest.memberships.find((row) => row.officeTermId === prTerm.id)).toMatchObject({ startsAt: "2025-01-03", endsAt: "2029-01-03" });
    expect(compiled.manifest.officeTerms.filter((term) => compiled.manifest.offices.find((office) => office.id === term.officeId)?.chamber === "house" && term.officeId !== prOffice.id).every((term) => term.endsAt === "2027-01-03")).toBe(true);
    expect(JSON.stringify(compiled.manifest)).not.toContain("original_publisher");
    expect(compiled.manifest.contests).toEqual([]); expect(compiled.manifest.acsObservations).toEqual([]); expect(compiled.manifest.financeAggregates).toEqual([]);
    expect(validateReleaseManifest(compiled.manifest).success).toBe(true); expect(computeCanonicalDataChecksum(compiled.manifest)).toBe(compiled.manifest.canonicalDataChecksumSha256);
    expect(compiled.manifest.geometryArtifacts.map((row) => row.checksumSha256)).toEqual(["66a71a6b18689748f53acbc8c3e51eae41a10558cf7a8aebebe4cdeaba973cf6", "b10fd4828f7736ee72c508e8d183b0450786e580de861831311e901368f2f8f3"]);
    expect(compileBoundaryBundle(compiled.manifest as unknown as PrototypeManifest, compiled.boundaryBundle)).toHaveLength(497);
  }, 120_000);
});
