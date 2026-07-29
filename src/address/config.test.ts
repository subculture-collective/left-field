import { describe, expect, it } from "vitest";
import { parseAddressConfig } from "./config";

describe("address configuration", () => {
  it("does not let environment mode elevate the feature", () => {
    expect(parseAddressConfig({ ADDRESS_LOOKUP_MODE: "enabled" }, "disabled")).toEqual({ mode: "disabled" });
    expect(() => parseAddressConfig({ ADDRESS_LOOKUP_KILL_SWITCH: "allow", ADDRESS_DEPLOYMENT_ID: "x", ADDRESS_DEPLOYMENT_ALLOWLIST: "x", ADDRESS_APPROVAL_REVISION: "a".repeat(64), ADDRESS_DATABASE_URL: "x", ADDRESS_RELEASE_ID: "x", ADDRESS_PRODUCT_VINTAGE: "2025" }, "enabled")).toThrow();
  });
});
