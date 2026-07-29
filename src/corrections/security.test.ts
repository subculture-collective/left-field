import { describe, expect, it } from "vitest";

import { canonicalTrustedIp, correctionAnonymousSubjectHash, generateCorrectionIdempotencyToken, issueCorrectionCsrf, parseCorrectionCsrfCookie, parseCorrectionSecurityConfig, validateCorrectionRequestHeaders, verifyCorrectionCsrf } from "./security";

const env = { CORRECTION_KILL_SWITCH: "allow", CORRECTION_APPROVAL_REVISION: "a".repeat(64), CORRECTION_PUBLIC_ORIGIN: "https://example.test", CORRECTION_TRUSTED_IP_HEADER: "x-edge-client-ip", CORRECTION_CSRF_SECRET: "a".repeat(32), CORRECTION_RATE_HMAC_SECRET: "b".repeat(32) };
const verified = { packageSha256: "a".repeat(64), expiresAt: "2099-01-01T00:00:00.000Z" };
const config = parseCorrectionSecurityConfig(env, verified);

describe("correction security", () => {
  it("fails closed for weak configuration", () => {
    expect(() => parseCorrectionSecurityConfig({ ...env, CORRECTION_PUBLIC_ORIGIN: "https://example.test/path" }, verified)).toThrow();
    expect(() => parseCorrectionSecurityConfig({ ...env, CORRECTION_CSRF_SECRET: "weak" }, verified)).toThrow();
    expect(() => parseCorrectionSecurityConfig({ ...env, CORRECTION_TRUSTED_IP_HEADER: "x-forwarded-for" }, verified)).toThrow();
    expect(() => parseCorrectionSecurityConfig({ ...env, CORRECTION_APPROVAL_REVISION: "b".repeat(64) }, verified)).toThrow();
    expect(() => parseCorrectionSecurityConfig({ ...env, CORRECTION_KILL_SWITCH: "deny" }, verified)).toThrow();
  });
  it("issues secure CSRF material and verifies its bounded lifetime", () => {
    const material = issueCorrectionCsrf(config, 1_000);
    expect(material.cookie).toBe(`__Host-correction_csrf=${material.nonce}; Max-Age=1800; Path=/; Secure; HttpOnly; SameSite=Strict`);
    expect(material.cookie).not.toContain("Domain=");
    expect(verifyCorrectionCsrf(config, material.nonce, material.token, 1_000 + 30 * 60 * 1000)).toBe(true);
    expect(verifyCorrectionCsrf(config, material.nonce, material.token, 1_000 + 30 * 60 * 1000 + 1)).toBe(false);
    expect(verifyCorrectionCsrf(config, "different", material.token, 1_000)).toBe(false);
    expect(verifyCorrectionCsrf(config, material.nonce.slice(1), material.token, 1_000)).toBe(false);
    expect(generateCorrectionIdempotencyToken()).not.toHaveLength(0);
  });
  it("accepts exactly one well-formed correction cookie", () => {
    const nonce = issueCorrectionCsrf(config, 1_000).nonce;
    expect(parseCorrectionCsrfCookie(`other=x; __Host-correction_csrf=${nonce}`)).toBe(nonce);
    for (const cookie of ["__Host-correction_csrf=bad", `__Host-correction_csrf=${nonce}; __Host-correction_csrf=${nonce}`, `__Host-correction_csrf=${nonce}, other=x`, "broken"]) expect(parseCorrectionCsrfCookie(cookie)).toBeUndefined();
  });
  it("requires exact request metadata and one canonical edge IP", () => {
    const good = new Headers({ origin: env.CORRECTION_PUBLIC_ORIGIN, "sec-fetch-site": "same-origin", "content-type": "application/json; charset=utf-8", "x-edge-client-ip": "2001:0db8::1" });
    expect(validateCorrectionRequestHeaders(good, config)).toBe("2001:db8::1");
    for (const headers of [new Headers({ "content-type": "application/json", "x-edge-client-ip": "1.2.3.4" }), new Headers({ origin: env.CORRECTION_PUBLIC_ORIGIN, "sec-fetch-site": "cross-site", "content-type": "application/json", "x-edge-client-ip": "1.2.3.4" }), new Headers({ origin: env.CORRECTION_PUBLIC_ORIGIN, "content-type": "text/plain", "x-edge-client-ip": "1.2.3.4" })]) expect(validateCorrectionRequestHeaders(headers, config)).toBeUndefined();
    for (const ip of [null, "1.2.3.4, 5.6.7.8", " 1.2.3.4", "not-an-ip"]) expect(canonicalTrustedIp(ip)).toBeUndefined();
  });
  it("hashes anonymously and rotates daily", () => {
    expect(correctionAnonymousSubjectHash(config, "203.0.113.1", new Date("2026-01-01T01:00:00Z"))).toBe(correctionAnonymousSubjectHash(config, "203.0.113.1", new Date("2026-01-01T23:00:00Z")));
    expect(correctionAnonymousSubjectHash(config, "203.0.113.1", new Date("2026-01-01T01:00:00Z"))).not.toBe(correctionAnonymousSubjectHash(config, "203.0.113.1", new Date("2026-01-02T01:00:00Z")));
  });
});
