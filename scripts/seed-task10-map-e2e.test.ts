import { describe, expect, it } from "vitest";
import { assertTask10E2eSeedEnvironment } from "./seed-task10-map-e2e";

describe("Task10 E2E seed safety", () => {
  it("requires a disposable database and local temporary map root", () => {
    expect(() => assertTask10E2eSeedEnvironment({ DATABASE_URL: "postgres://localhost/seats", MAP_ARTIFACT_ROOT: "/tmp/maps" })).toThrow("ending in _test");
    expect(() => assertTask10E2eSeedEnvironment({ DATABASE_URL: "postgres://prod.example/seats_test", MAP_ARTIFACT_ROOT: "/tmp/maps" })).toThrow("refuses production");
    expect(() => assertTask10E2eSeedEnvironment({ DATABASE_URL: "postgres://localhost/seats_test", MAP_ARTIFACT_ROOT: "/srv/maps" })).toThrow("temp/test path");
    expect(() => assertTask10E2eSeedEnvironment({ DATABASE_URL: "postgres://localhost/seats_test", MAP_ARTIFACT_ROOT: "/tmp" })).toThrow("dedicated Task10 directory");
    expect(() => assertTask10E2eSeedEnvironment({ DATABASE_URL: "postgres://localhost/seats_test", MAP_ARTIFACT_ROOT: "/tmp/maps" })).toThrow("dedicated Task10 directory");
    expect(assertTask10E2eSeedEnvironment({ DATABASE_URL: "postgres://localhost/seats_test", MAP_ARTIFACT_ROOT: "/tmp/task10-maps" })).toMatchObject({ mapRoot: "/tmp/task10-maps" });
  });
});
