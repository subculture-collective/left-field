import { describe, expect, it } from "vitest";
import { parseBioguideDob } from "./bioguide";
import { fetchCongressMembers, type CongressFetch } from "./congress";

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

describe("Congress member facts", () => {
  it("enforces current-member paging and redacts all returned URLs", async () => {
    const calls: string[] = []; const f: CongressFetch = async input => { calls.push(String(input)); const url = new URL(String(input)); if (url.pathname === "/v3/member") return url.searchParams.get("offset") === "250" ? response({ members: [{ url: "https://api.congress.gov/v3/member/A000001?api_key=upstream-secret&trace=1" }], pagination: { next: null } }) : response({ members: [{ url: "https://api.congress.gov/v3/member/B000001?api_key=upstream-secret" }], pagination: { next: "https://api.congress.gov/v3/member?offset=250&currentMember=false&api_key=upstream-secret" } }); return response({ member: { bioguideId: url.pathname.endsWith("A000001") ? "A000001" : "B000001", birthYear: "1970", updateDate: "2026-01-02T00:00:00Z" } }); };
    await expect(fetchCongressMembers({ fetch: f, apiKey: "very-secret", listUrl: "https://api.congress.gov/v3/member?currentMember=false&api_key=listed-secret" })).resolves.toMatchObject([{ bioguideId: "A000001", detailUrl: "https://api.congress.gov/v3/member/A000001" }, { bioguideId: "B000001", detailUrl: "https://api.congress.gov/v3/member/B000001" }]);
    const listCalls = calls.filter(call => new URL(call).pathname === "/v3/member");
    for (const call of listCalls) { const url = new URL(call); expect(url.searchParams.get("currentMember")).toBe("true"); expect(url.searchParams.get("limit")).toBe("250"); }
    expect(calls.filter(call => new URL(call).pathname.startsWith("/v3/member/")).map(call => new URL(call).pathname)).toEqual(["/v3/member/A000001", "/v3/member/B000001"]);
    expect(calls.join(" ")).not.toContain("upstream-secret"); expect(calls.join(" ")).not.toContain("listed-secret");
    await expect(fetchCongressMembers({ fetch: async () => { throw new Error("very-secret"); }, apiKey: "very-secret" })).rejects.toThrow("CONGRESS_FETCH_FAILED");
  });
  it("rejects redirects, unsafe pagination, cycles, limits, timeouts and malformed payloads", async () => {
    await expect(fetchCongressMembers({ fetch: async () => response({ members: [], pagination: { next: "https://evil.test/v3/member" } }), apiKey: "x" })).rejects.toThrow("CONGRESS_URL_DISALLOWED");
    await expect(fetchCongressMembers({ fetch: async () => response({ members: [], pagination: { next: "https://api.congress.gov/v3/member" } }), apiKey: "x" })).rejects.toThrow("CONGRESS_PAGINATION_CYCLE");
    await expect(fetchCongressMembers({ fetch: async () => response({ nope: true }), apiKey: "x" })).rejects.toThrow("CONGRESS_LIST_MALFORMED");
    await expect(fetchCongressMembers({ fetch: async () => response({ members: Array.from({ length: 251 }, () => ({ url: "https://api.congress.gov/v3/member/A000001" })), pagination: { next: null } }), apiKey: "x" })).rejects.toThrow("CONGRESS_LIST_MALFORMED");
    await expect(fetchCongressMembers({ fetch: async (_i, init) => { await new Promise<void>(resolve => init?.signal?.addEventListener("abort", () => resolve(), { once: true })); throw new Error("abort"); }, apiKey: "x" })).rejects.toThrow("CONGRESS_TIMEOUT");
  }, 15_000);
  it("rejects malformed details and duplicate conflicting IDs", async () => {
    let list = true; const f: CongressFetch = async () => list ? (list = false, response({ members: [{ url: "https://api.congress.gov/v3/member/A000001" }, { url: "https://api.congress.gov/v3/member/A000001" }], pagination: { next: null } })) : response({ member: { bioguideId: "A000001", birthYear: "bad", updateDate: "x" } });
    await expect(fetchCongressMembers({ fetch: f, apiKey: "x" })).rejects.toThrow("CONGRESS_MEMBER_MALFORMED");
    let calls = 0; const conflict: CongressFetch = async () => calls++ === 0 ? response({ members: [{ url: "https://api.congress.gov/v3/member/A000001" }, { url: "https://api.congress.gov/v3/member/A000001" }], pagination: { next: null } }) : response({ member: { bioguideId: "A000001", birthYear: calls === 2 ? "1970" : "1971", updateDate: "2026-01-02T00:00:00Z" } });
    await expect(fetchCongressMembers({ fetch: conflict, apiKey: "x" })).rejects.toThrow("CONGRESS_DUPLICATE_CONFLICT");
  });
  it("extracts only an unambiguous exact prose date", () => {
    expect(parseBioguideDob({ bioguideId: "A000001", profileText: "She was born on January 2, 1970." })).toEqual({ status: "exact", birthDate: "1970-01-02" });
    expect(parseBioguideDob({ bioguideId: "A000001", profileText: "born January 2, 1970; born March 3, 1971" }).status).toBe("ambiguous");
    expect(parseBioguideDob({ bioguideId: "A000001", profileText: "born in 1970" })).toEqual({ status: "unavailable", birthDate: null });
  });
});
