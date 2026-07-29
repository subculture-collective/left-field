import { afterEach, describe, expect, it, vi } from "vitest";

const pools = vi.hoisted((): Array<Record<string, unknown>> => []);
vi.mock("pg", () => ({ Pool: class { public constructor(options: Record<string, unknown>) { pools.push(options); } public end = vi.fn(); } }));

import { closeDb, getIngestPool, getNationwideFinalizerPool, getPool } from "./client";

const originalEnv = { ...process.env };
afterEach(async () => { await closeDb(); pools.length = 0; process.env = { ...originalEnv }; });

describe("database runtime pools", () => {
  it("fails closed without WEB_DATABASE_URL in production", () => {
    process.env = { NODE_ENV: "production", DATABASE_URL: "postgres://migration-only" };
    expect(getPool).toThrow("WEB_DATABASE_URL is required");
  });

  it("uses DATABASE_URL only as a nonproduction web fallback", () => {
    process.env = { NODE_ENV: "development", DATABASE_URL: "postgres://local-web" };
    getPool();
    expect(pools[0]).toMatchObject({ connectionString: "postgres://local-web", max: 10, connectionTimeoutMillis: 5_000, query_timeout: 15_000, statement_timeout: 15_000, idleTimeoutMillis: 30_000 });
  });

  it("uses the dedicated bounded ingestion URL", () => {
    process.env = { NODE_ENV: "production", INGEST_DATABASE_URL: "postgres://ingest" };
    getIngestPool();
    expect(pools[0]).toMatchObject({ connectionString: "postgres://ingest", max: 10, connectionTimeoutMillis: 5_000, query_timeout: 15_000, statement_timeout: 15_000, idleTimeoutMillis: 30_000 });
  });

  it("requires the ingestion URL in production", () => {
    process.env = { NODE_ENV: "production", DATABASE_URL: "postgres://migration-only" };
    expect(getIngestPool).toThrow("INGEST_DATABASE_URL is required");
  });

  it("uses a distinct bounded nationwide-finalizer URL", () => {
    process.env = { NODE_ENV: "production", NATIONWIDE_FINALIZER_DATABASE_URL: "postgres://finalizer" };
    getNationwideFinalizerPool();
    expect(pools[0]).toMatchObject({ connectionString: "postgres://finalizer", max: 2, connectionTimeoutMillis: 5_000, query_timeout: 310_000, statement_timeout: 300_000, idleTimeoutMillis: 30_000 });
  });

  it("requires the nationwide-finalizer URL", () => {
    process.env = { NODE_ENV: "production", INGEST_DATABASE_URL: "postgres://ingest" };
    expect(getNationwideFinalizerPool).toThrow("NATIONWIDE_FINALIZER_DATABASE_URL is required");
  });
});
