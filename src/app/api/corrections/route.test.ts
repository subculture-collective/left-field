import { describe, expect, it } from "vitest";

import type { SubmitCorrectionResult } from "@/corrections/repository";
import { issueCorrectionCsrf, parseCorrectionSecurityConfig } from "@/corrections/security";
import { createCorrectionHandler } from "./route";

const config = parseCorrectionSecurityConfig({ CORRECTION_KILL_SWITCH: "allow", CORRECTION_APPROVAL_REVISION: "a".repeat(64), CORRECTION_PUBLIC_ORIGIN: "https://example.test", CORRECTION_TRUSTED_IP_HEADER: "x-edge-client-ip", CORRECTION_CSRF_SECRET: "a".repeat(32), CORRECTION_RATE_HMAC_SECRET: "b".repeat(32) }, { packageSha256: "a".repeat(64), expiresAt: "2099-01-01T00:00:00.000Z" });
const now = new Date("2026-01-02T03:04:05.000Z");
const id = "5d39ad18-8bd5-4a0f-922d-4f04942d1433";
const body = { releaseId: "rel_1", fieldPath: "identity.party", explanation: "This explanation is sufficiently detailed." };
const enabledGates = async () => ({ version: 2 as const, generatedAt: "", signerKeyId: "test", signature: "", correction: { mode: "enabled" as const, packageSha256: "a".repeat(64), expiresAt: "2099-01-01T00:00:00.000Z" }, address: { mode: "disabled" as const } });

function request(overrides: { body?: unknown; headers?: Record<string, string> } = {}): Request {
  const csrf = issueCorrectionCsrf(config, now.getTime());
  return new Request("https://example.test/api/corrections", { method: "POST", headers: {
    origin: config.publicOrigin, "sec-fetch-site": "same-origin", "content-type": "application/json", "x-edge-client-ip": "203.0.113.1",
    cookie: csrf.cookie.split(";", 1)[0], "x-csrf-token": csrf.token, "idempotency-key": "a".repeat(43), ...overrides.headers,
  }, body: JSON.stringify(overrides.body ?? body) });
}
function handler(result: SubmitCorrectionResult = { outcome: "accepted", correctionId: id, created: true, retryAfter: null }) {
  return createCorrectionHandler({ getGates: enabledGates, getConfig: () => config, now: () => now, createRepository: () => ({ consumeAttempt: async () => ({ allowed: true, retryAfter: null }), submit: async () => result }) });
}

describe("corrections route", () => {
  it("is disabled before reading a body or constructing dependencies", async () => {
    let constructed = false;
    const handler = createCorrectionHandler({ getGates: async () => ({ version: 2, generatedAt: "", signerKeyId: "", signature: "", correction: { mode: "disabled" }, address: { mode: "disabled" } }), getConfig: () => { throw new Error("must not parse"); }, createRepository: () => { constructed = true; throw new Error("must not construct"); } });
    const response = await handler.POST(new Request("https://x/api/corrections", { method: "POST", duplex: "half", body: new ReadableStream({ pull() { throw new Error("body read"); } }) } as RequestInit));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: "disabled" }); expect(constructed).toBe(false);
  });
  it("issues no-store CSRF and idempotency material", async () => {
    const response = await handler().GET();
    const payload = await response.json();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toMatch(/^__Host-correction_csrf=[A-Za-z0-9_-]{43}; Max-Age=1800; Path=\/; Secure; HttpOnly; SameSite=Strict$/);
    expect(payload).toMatchObject({ csrfToken: expect.any(String), idempotencyToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
  });
  it("fails closed when configuration or the database cannot be initialized", async () => {
    expect((await createCorrectionHandler({ getGates: enabledGates, getConfig: () => { throw new Error("secret"); } }).GET()).status).toBe(503);
    const unavailable = await createCorrectionHandler({ getGates: enabledGates, getConfig: () => config, createRepository: () => { throw new Error("database url"); } }).POST(request());
    expect(await unavailable.json()).toEqual({ status: "unavailable" });
    expect((await createCorrectionHandler({ getGates: enabledGates, getConfig: () => config, createRepository: () => { throw new Error("database url"); } }).GET()).status).toBe(503);
  });
  it.each([
    [{ origin: "https://evil.test" }, 403, "forbidden"], [{ "sec-fetch-site": "cross-site" }, 403, "forbidden"], [{ "x-edge-client-ip": "1.1.1.1, 2.2.2.2" }, 403, "forbidden"],
    [{ "content-type": "text/plain" }, 415, "unsupported_media_type"], [{ cookie: "__Host-correction_csrf=bad; __Host-correction_csrf=bad" }, 403, "forbidden"],
    [{ "x-csrf-token": "bad" }, 403, "forbidden"], [{ "idempotency-key": "bad" }, 400, "malformed"],
  ])("rejects unsafe request metadata", async (headers, status, outcome) => {
    const response = await handler().POST(request({ headers }));
    expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toBe("no-store"); expect(await response.json()).toEqual({ status: outcome });
  });
  it("rejects malformed and bounded bodies", async () => {
    expect((await handler().POST(request({ body: { ...body, extra: true } }))).status).toBe(400);
    expect((await handler().POST(request({ body: { ...body, explanation: "x".repeat(33 * 1024) } }))).status).toBe(413);
  });
  it.each([
    [{ outcome: "accepted", correctionId: id, created: true, retryAfter: null }, 202, { status: "accepted", correctionId: id }],
    [{ outcome: "accepted", correctionId: id, created: false, retryAfter: null }, 202, { status: "replay", correctionId: id }],
    [{ outcome: "idempotency_conflict", correctionId: null, created: false, retryAfter: null }, 409, { status: "conflict" }],
    [{ outcome: "rate_limited", correctionId: null, created: false, retryAfter: 99999 }, 429, { status: "rate_limited" }],
    [{ outcome: "target_unavailable", correctionId: null, created: false, retryAfter: null }, 400, { status: "malformed" }],
  ] as const)("maps repository outcomes", async (result, status, payload) => {
    const response = await handler(result).POST(request());
    expect(response.status).toBe(status); expect(await response.json()).toEqual(payload);
    if (status === 429) expect(response.headers.get("retry-after")).toBe("3600");
  });
  it("sanitizes database exceptions", async () => {
    const response = await createCorrectionHandler({ getGates: enabledGates, getConfig: () => config, now: () => now, createRepository: () => ({ consumeAttempt: async () => ({ allowed: true, retryAfter: null }), submit: async () => { throw new Error("postgres password"); } }) }).POST(request());
    expect(response.status).toBe(503); expect(await response.text()).toBe('{"status":"unavailable"}');
  });
  it("throttles trusted malformed transport before parsing the body", async () => {
    const response = await createCorrectionHandler({ getGates: enabledGates, getConfig: () => config, now: () => now, createRepository: () => ({ consumeAttempt: async () => ({ allowed: false, retryAfter: 12 }), submit: async () => { throw new Error("must not submit"); } }) }).POST(request({ headers: { "idempotency-key": "bad" } }));
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("12"); expect(await response.json()).toEqual({ status: "rate_limited" });
  });
});
