import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { compileBoundaryBundle } from "./manifest";
import { coherentBoundaryBundle, coherentManifest } from "@/test/fixtures/prototype-manifest";

describe("boundary bundle compiler", () => {
  it("binds raw bytes to artifact identity", () => {
    const manifest = coherentManifest(); const bundle = coherentBoundaryBundle(manifest);
    expect(compileBoundaryBundle(manifest, bundle)).toHaveLength(manifest.geographyVersions.length);
    expect(() => compileBoundaryBundle(manifest, [{ ...bundle[0]!, bytes: Buffer.from("{}") }])).toThrow("checksum");
    expect(() => compileBoundaryBundle(manifest, [{ ...bundle[0]!, objectKey: "elsewhere.geojson" }])).toThrow("object key");
  });

  it("rejects duplicate, missing, and malformed feature geometry", () => {
    const manifest = coherentManifest(); const bundle = coherentBoundaryBundle(manifest); const parsed = JSON.parse(bundle[0]!.bytes.toString());
    parsed.features.pop();
    const bytes = Buffer.from(JSON.stringify(parsed));
    (manifest.geometryArtifacts[0] as { checksumSha256: string }).checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    expect(() => compileBoundaryBundle(manifest, [{ ...bundle[0]!, bytes }])).toThrow("missing");
  });
});
