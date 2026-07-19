import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadCanonicalBoundaries } from "@/data/boundary-loader";
import { canonicalManifest } from "@/data/canonical-manifest";
import { compileBoundaryBundle } from "@/db/manifest";

describe("canonical boundary loader", () => {
  it("covers every manifest geography with canonical MultiPolygons", async () => {
    const bundle = await loadCanonicalBoundaries(canonicalManifest);
    const boundaries = compileBoundaryBundle(canonicalManifest, bundle);
    expect([...boundaries.keys()].sort()).toEqual(canonicalManifest.geographyVersions.map((geography) => geography.id).sort());
    expect([...boundaries.values()].every((boundary) => boundary.type === "MultiPolygon")).toBe(true);
  });

  it("rejects an object key outside data", async () => {
    await expect(loadCanonicalBoundaries({ geometryArtifacts: [{ ...canonicalManifest.geometryArtifacts[0]!, objectKey: "../package.json" }] })).rejects.toThrow("escapes data root");
  });

  it("rejects a data symlink that resolves outside the data root", async () => {
    const outside = await mkdtemp(join(tmpdir(), "boundary-loader-"));
    const link = join(process.cwd(), "data", ".boundary-loader-escape-test");
    await writeFile(join(outside, "boundary.geojson"), "outside");
    try {
      await symlink(join(outside, "boundary.geojson"), link);
    } catch (error: unknown) {
      await rm(outside, { force: true, recursive: true });
      if (error instanceof Error && ["EPERM", "EOPNOTSUPP", "ENOSYS"].includes((error as NodeJS.ErrnoException).code ?? "")) return;
      throw error;
    }
    try {
      await expect(loadCanonicalBoundaries({ geometryArtifacts: [{ ...canonicalManifest.geometryArtifacts[0]!, objectKey: "data/.boundary-loader-escape-test" }] })).rejects.toThrow("escapes data root");
    } finally {
      await rm(link, { force: true });
      await rm(outside, { force: true, recursive: true });
    }
  });

  it("rejects a directory artifact target", async () => {
    const directory = join(process.cwd(), "data", ".boundary-loader-directory-test");
    await mkdir(directory);
    try {
      await expect(loadCanonicalBoundaries({ geometryArtifacts: [{ ...canonicalManifest.geometryArtifacts[0]!, objectKey: "data/.boundary-loader-directory-test" }] })).rejects.toThrow("not a file");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
