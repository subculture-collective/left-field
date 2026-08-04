import { describe, expect, it } from "vitest";

import { LocalMapArtifactStore } from "./map-artifact-store";
import { configuredMapArtifactStore } from "./runtime-map-store";

describe("runtime map store", () => {
  it("supports the configured read-only local artifact root in production", () => {
    expect(configuredMapArtifactStore({ NODE_ENV: "production", MAP_ARTIFACT_ROOT: "/var/lib/dsa-seats/maps/r1-factual" })).toBeInstanceOf(LocalMapArtifactStore);
  });

  it("still requires an explicitly configured artifact store", () => {
    expect(() => configuredMapArtifactStore({ NODE_ENV: "production" })).toThrow("Require MAP_ARTIFACT_ROOT or MAP_ARTIFACT_BUCKET");
  });
});
