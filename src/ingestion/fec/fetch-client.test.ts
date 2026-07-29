import { describe, expect, it, vi } from "vitest";
import { aggregateOutsideSpending, type FecCandidateMapping } from "./aggregates";
import { decodeFecSanitizedEnvelope } from "./envelope";
import {
  fetchFecSanitizedEnvelope,
  fetchFecSanitizedEnvelopeFromEnv,
  type OpenFecFetch,
} from "./fetch-client";

const mapping = (): FecCandidateMapping => ({
  candidateId: "H00000001",
  electionCycle: 2024,
  candidacyId: "cand_test",
  seatCycleId: "seat_test",
  snapshotId: "snap_mapping",
  committees: [
    {
      committeeId: "C00000001",
      relationshipType: "principal_campaign_committee",
      effectiveFrom: "2024-01-01",
      effectiveTo: null,
    },
  ],
});

const resultFor = (pathname: string): Record<string, unknown> => {
  if (pathname.endsWith("/committees/"))
    return {
      committee_id: "C00000001",
      name: "Safe committee",
      designation: "P",
      committee_type: "H",
      cycles: [2024],
      candidate_ids: ["H00000001"],
      treasurer_name: "CANARY TREASURER",
      email: "canary@example.test",
      street_1: "CANARY ADDRESS",
    };
  if (pathname === "/v1/reports/house-senate/")
    return {
      committee_id: "C00000001",
      report_form: "F3",
      report_type: "YE",
      coverage_start_date: "2024-01-01T00:00:00",
      coverage_end_date: "2024-12-31T00:00:00",
      receipt_date: "2024-12-31T12:00:00",
      file_number: 1,
      previous_file_number: null,
      amendment_indicator: "N",
      amendment_chain: ["1"],
      most_recent: true,
      most_recent_file_number: 1,
      cash_on_hand_end_period: 1,
      total_receipts_ytd: 2,
      total_disbursements_ytd: 1,
    };
  return {
    candidate_id: "H00000001",
    committee_id: "C00000002",
    cycle: 2024,
    support_oppose_indicator: "S",
    total: 3,
    candidate_name: "CANARY CANDIDATE NAME IS NOT RETAINED",
    committee_name: "CANARY SPENDER NAME IS NOT RETAINED",
  };
};

const successfulFetcher = (captured: string[]): OpenFecFetch => async (input, init) => {
  const url = new URL(String(input));
  captured.push(url.toString());
  expect(init).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
  expect(url.origin).toBe("https://api.open.fec.gov");
  expect(url.searchParams.has("api_key")).toBe(false);
  expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("TOP_SECRET_KEY");
  const page = Number(url.searchParams.get("page"));
  const results = page === 1 ? [resultFor(url.pathname)] : [];
  return new Response(
    JSON.stringify({
      api_version: "1.0",
      pagination: {
        count: 1,
        pages: 1,
        per_page: 100,
        is_count_exact: true,
      },
      results,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

describe("OpenFEC sanitized fetch boundary", () => {
  it("projects allowlisted aggregate fields and never retains keys or contact data", async () => {
    const captured: string[] = [];
    const bytes = await fetchFecSanitizedEnvelope({
      apiKey: "TOP_SECRET_KEY",
      sourceLockSha256: "a".repeat(64),
      releaseCutoff: "2024-12-31",
      electionKey: "2024-ca-01-general",
      mapping: mapping(),
      fetcher: successfulFetcher(captured),
      sleep: async () => undefined,
    });
    expect(captured).toHaveLength(6);
    const reportUrls = captured
      .map((value) => new URL(value))
      .filter((url) => url.pathname === "/v1/reports/house-senate/");
    expect(reportUrls).toHaveLength(2);
    expect(reportUrls[0]!.searchParams.get("committee_id")).toBe("C00000001");
    expect(reportUrls[0]!.searchParams.get("max_receipt_date")).toBe(
      "2024-12-31",
    );
    expect(captured.some((value) => value.includes("/totals/"))).toBe(false);
    const serialized = Buffer.from(bytes).toString("utf8");
    expect(serialized).not.toMatch(
      /TOP_SECRET_KEY|CANARY TREASURER|canary@example|CANARY ADDRESS|CANARY CANDIDATE|CANARY SPENDER/i,
    );
    const envelope = decodeFecSanitizedEnvelope(bytes);
    expect(envelope).toMatchObject({
      candidateId: "H00000001",
      committees: [{ committeeId: "C00000001", name: "Safe committee" }],
      reports: [{ fileNumber: 1, totalReceiptsYtd: "2.00" }],
      candidateTotalsStatus: "not_collected_historical_cutoff_unsupported",
      outsideSpending: [
        {
          committeeId: "C00000002",
          electionFull: false,
          amount: "3.00",
        },
      ],
    });
    for (const receipt of envelope.pageReceipts) {
      expect(receipt.query.some((query) => /api[_-]?key/i.test(query.key))).toBe(
        false,
      );
      expect(receipt.path.startsWith("/v1/")).toBe(true);
    }
    expect(
      aggregateOutsideSpending(
        envelope.candidateId,
        envelope.electionCycle,
        envelope.outsideSpending,
        true,
        true,
      ),
    ).toMatchObject({ publishableAsExactElection: false, supportAmount: "3.00" });
  });

  it("retries bounded transient failures without exposing the response body", async () => {
    const captured: string[] = [];
    const success = successfulFetcher(captured);
    let attempts = 0;
    const fetcher: OpenFecFetch = async (input, init) => {
      attempts += 1;
      if (attempts === 1)
        return new Response("CANARY PRIVATE ERROR BODY", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      return success(input, init);
    };
    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: mapping(),
        fetcher,
        sleep: async () => undefined,
      }),
    ).resolves.toBeDefined();
    expect(attempts).toBe(7);
  });

  it("fails before network without a credential and emits finite HTTP errors", async () => {
    let called = false;
    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: mapping(),
        fetcher: async () => {
          called = true;
          return new Response();
        },
      }),
    ).rejects.toThrow("FEC_API_KEY_REQUIRED");
    expect(called).toBe(false);

    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: mapping(),
        fetcher: async () =>
          new Response("CANARY PRIVATE ERROR BODY", { status: 403 }),
      }),
    ).rejects.toThrow(/^FEC_FETCH_HTTP_ERROR$/);
  });

  it("loads the runtime credential before any network request", async () => {
    let called = false;
    const options = {
      sourceLockSha256: "a".repeat(64),
      releaseCutoff: "2024-12-31",
      electionKey: "2024-ca-01-general",
      mapping: mapping(),
      fetcher: async () => { called = true; return new Response(); },
    };
    await expect(fetchFecSanitizedEnvelopeFromEnv(options, { NODE_ENV: "test", FEC_API_CREDENTIAL: "one", FEC_API_KEY: "two" })).rejects.toThrow("FEC_API_CREDENTIAL_CONFLICT");
    expect(called).toBe(false);
  });

  it("rejects duplicate mapped committees before network amplification", async () => {
    let called = false;
    const base = mapping();
    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: {
          ...base,
          committees: [base.committees[0]!, base.committees[0]!],
        },
        fetcher: async () => {
          called = true;
          return new Response();
        },
      }),
    ).rejects.toThrow("FEC_MAPPING_INVALID");
    expect(called).toBe(false);
    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: {
          ...base,
          committees: [
            { ...base.committees[0]!, effectiveTo: "2023-12-31" },
          ],
        },
        fetcher: async () => {
          called = true;
          return new Response();
        },
      }),
    ).rejects.toThrow("FEC_MAPPING_INVALID");
    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: {
          ...base,
          committees: [
            { ...base.committees[0]!, effectiveFrom: "2024-01-01junk" },
          ],
        },
        fetcher: async () => {
          called = true;
          return new Response();
        },
      }),
    ).rejects.toThrow("FEC_MAPPING_INVALID");
  });

  it("fails when a successful response crosses the absolute deadline", async () => {
    let now = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      await expect(
        fetchFecSanitizedEnvelope({
          apiKey: "TOP_SECRET_KEY",
          sourceLockSha256: "a".repeat(64),
          releaseCutoff: "2024-12-31",
          electionKey: "2024-ca-01-general",
          mapping: mapping(),
          fetcher: async () => {
            now = 300_001;
            return new Response(
              JSON.stringify({
                pagination: {
                  count: 0,
                  pages: 0,
                  per_page: 100,
                  is_count_exact: true,
                },
                results: [],
              }),
            );
          },
        }),
      ).rejects.toThrow("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
    } finally {
      clock.mockRestore();
    }
  });

  it("does not await a collaborator-controlled response cancellation", async () => {
    const outcome = await Promise.race([
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: mapping(),
        fetcher: async () =>
          new Response(
            new ReadableStream({
              cancel: () => new Promise<void>(() => undefined),
            }),
            { status: 403 },
          ),
      }).then(
        () => "unexpected success",
        (error: Error) => error.message,
      ),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("test timeout"), 100),
      ),
    ]);
    expect(outcome).toBe("FEC_FETCH_HTTP_ERROR");
  });

  it("rejects an already-aborted acquisition before calling fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    let called = false;
    await expect(
      fetchFecSanitizedEnvelope({
        apiKey: "TOP_SECRET_KEY",
        sourceLockSha256: "a".repeat(64),
        releaseCutoff: "2024-12-31",
        electionKey: "2024-ca-01-general",
        mapping: mapping(),
        signal: controller.signal,
        fetcher: async () => {
          called = true;
          return new Response();
        },
      }),
    ).rejects.toThrow("FEC_FETCH_TIMEOUT");
    expect(called).toBe(false);
  });
});
