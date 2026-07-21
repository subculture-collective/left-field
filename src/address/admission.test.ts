import { describe, expect, it, vi } from "vitest";
import { AddressAdmissionRepository, addressAnonymousSubjectHash } from "./admission";
import { CallerAbortError } from "./census-geocoder";

describe("address admission subject hashing", () => {
  const secret = "a".repeat(32);
  it("separates purposes and their exact rotation windows", () => {
    const at = new Date("2026-01-01T01:30:00Z");
    const metadata = addressAnonymousSubjectHash(secret, "203.0.113.1", "g1", "metadata", at);
    const lookup = addressAnonymousSubjectHash(secret, "203.0.113.1", "g1", "lookup", at);
    expect(metadata).not.toEqual(lookup);
    expect(metadata).not.toEqual(addressAnonymousSubjectHash(secret, "203.0.113.1", "g1", "metadata", new Date("2026-01-01T01:31:00Z")));
    expect(lookup).toEqual(addressAnonymousSubjectHash(secret, "203.0.113.1", "g1", "lookup", new Date("2026-01-01T01:59:59Z")));
    expect(lookup).not.toEqual(addressAnonymousSubjectHash(secret, "203.0.113.1", "g2", "lookup", at));
    expect(lookup).not.toEqual(addressAnonymousSubjectHash(secret, "203.0.113.1", "g1", "lookup", new Date("2026-01-01T02:00:00Z")));
  });
  it("fails closed for missing generation or weak secret", () => {
    expect(() => addressAnonymousSubjectHash("weak", "x", "g", "lookup")).toThrow();
    expect(() => addressAnonymousSubjectHash(secret, "x", "", "lookup")).toThrow();
  });

  it("owns a bounded transaction for every admission query", async () => {
    const client = { processID: 41, release: vi.fn(), query: vi.fn(async () => ({ rows: [{ allowed: true, retryAfter: null }] })) };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new AddressAdmissionRepository(pool as never, 123);
    const controller = new AbortController();
    const hash = Buffer.alloc(32);
    await repository.consumeMetadataAttempt(hash, controller.signal);
    expect((client.query.mock.calls as unknown as [string][]).map(([sql]) => sql)).toEqual(["BEGIN", "SET LOCAL statement_timeout = '123ms'", expect.stringContaining("consume_address_metadata_attempt_v1"), "COMMIT"]);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it("cancels an active admission, rolls it back, and destroys its uncertain client", async () => {
    let rejectQuery!: (error: Error) => void; let started!: () => void;
    const queryStarted = new Promise<void>(resolve => { started = resolve; });
    const client = { processID: 42, release: vi.fn(), query: vi.fn((sql: string) => sql.includes("consume_address") ? new Promise((_resolve, reject) => { rejectQuery = reject; started(); }) : Promise.resolve({ rows: [] })) };
    const pool = { connect: vi.fn(async () => client) }; const cancel = vi.fn(async () => true);
    const controller = new AbortController(); const pending = new AddressAdmissionRepository(pool as never, 5_000, cancel).consumeEnabledLookup(Buffer.alloc(32), controller.signal);
    await queryStarted; controller.abort(); rejectQuery(new Error("query canceled"));
    await expect(pending).rejects.toBeInstanceOf(CallerAbortError);
    expect(cancel).toHaveBeenCalledWith(42); expect(client.query).toHaveBeenCalledWith("ROLLBACK"); expect(client.release).toHaveBeenCalledWith(true);
  });

  it("destroys a client acquired after abort without executing admission", async () => {
    let acquire!: (client: { processID: number; release: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> }) => void;
    const checkout = new Promise<{ processID: number; release: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> }>(resolve => { acquire = resolve; });
    const client = { processID: 43, release: vi.fn(), query: vi.fn() }; const pool = { connect: vi.fn(() => checkout) };
    const controller = new AbortController(); const pending = new AddressAdmissionRepository(pool as never).consumeMetadataAttempt(Buffer.alloc(32), controller.signal);
    controller.abort(); await expect(pending).rejects.toBeInstanceOf(CallerAbortError);
    acquire(client); await Promise.resolve();
    expect(client.query).not.toHaveBeenCalled(); expect(client.release).toHaveBeenCalledWith(true);
  });
});
