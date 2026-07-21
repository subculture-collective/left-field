import { describe, expect, it } from "vitest";
import { assertMapOnlyInheritance } from "./finalize-maps";

const source = {
  canonicalDataChecksumSha256: "source-checksum", release: { id: "source" }, sources: [{ id: "census", releaseId: "source" }], snapshots: [{ id: "original", releaseId: "source" }], geometryArtifacts: [{ id: "original-artifact", releaseId: "source" }], mapArtifacts: [], snapshotDerivations: [], coverageRecords: [{ domain: "identity", releaseId: "source" }], people: [{ id: "person", releaseId: "source", displayName: "unchanged" }],
};
const candidate = {
  ...structuredClone(source), canonicalDataChecksumSha256: "candidate-checksum", release: { id: "candidate" },
  sources: [{ id: "census", releaseId: "candidate" }, { id: "src_maps_hash", releaseId: "candidate" }],
  snapshots: [{ id: "original", releaseId: "candidate" }, { id: "snap_map_1", releaseId: "candidate" }],
  geometryArtifacts: [{ id: "original-artifact", releaseId: "candidate" }, { id: "artifact_map_1", releaseId: "candidate" }],
  mapArtifacts: [{ id: "map_1", releaseId: "candidate" }], snapshotDerivations: [{ outputSnapshotId: "snap_map_1", releaseId: "candidate" }], coverageRecords: [{ domain: "identity", releaseId: "candidate" }, { domain: "maps", releaseId: "candidate" }], people: [{ id: "person", releaseId: "candidate", displayName: "unchanged" }],
};

describe("Task 10 map-only inheritance", () => {
  it("permits only deterministic map material and rejects unrelated candidate tampering", () => {
    expect(() => assertMapOnlyInheritance(source, candidate, "source", "candidate", "src_maps_hash")).not.toThrow();
    const tampered = structuredClone(candidate); tampered.people[0]!.displayName = "changed";
    expect(() => assertMapOnlyInheritance(source, tampered, "source", "candidate", "src_maps_hash")).toThrow("MAP_FINALIZE_INHERITANCE_INVALID");
  });
});
