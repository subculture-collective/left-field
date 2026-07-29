import { describe, expect, it } from "vitest";
import { loadFecApiCredential } from "./credential";

const env = (values: Record<string, string | undefined>): NodeJS.ProcessEnv => ({ NODE_ENV: "test", ...values });

describe("OpenFEC credential loading", () => {
  it("prefers the configured credential alias", () => {
    expect(loadFecApiCredential(env({ FEC_API_CREDENTIAL: "secret-value" }))).toBe("secret-value");
  });

  it("accepts the legacy name only for compatibility", () => {
    expect(loadFecApiCredential(env({ FEC_API_KEY: "legacy-value" }))).toBe("legacy-value");
  });

  it("accepts both only when they are identical", () => {
    expect(loadFecApiCredential(env({ FEC_API_CREDENTIAL: "same", FEC_API_KEY: "same" }))).toBe("same");
    expect(() => loadFecApiCredential(env({ FEC_API_CREDENTIAL: "one", FEC_API_KEY: "two" }))).toThrow("FEC_API_CREDENTIAL_CONFLICT");
  });

  it.each([undefined, "", " leading", "trailing ", "line\nbreak"])("rejects an invalid value", (value) => {
    expect(() => loadFecApiCredential(env({ FEC_API_CREDENTIAL: value }))).toThrow("FEC_API_CREDENTIAL_REQUIRED");
  });
});
