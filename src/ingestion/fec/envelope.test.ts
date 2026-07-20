import { describe, expect, it } from "vitest";
import {
  decodeFecSanitizedEnvelope,
  encodeFecSanitizedEnvelope,
  fecPageRequestSha256,
} from "./envelope";
import {
  fecEnvelopeFixture,
  fecEnvelopeWithoutAuthorizedCommittee,
} from "./fec-test-fixture";

describe("FEC sanitized envelope", () => {
  it("has one deterministic canonical encoding", () => {
    const value = fecEnvelopeFixture();
    const reversed = {
      ...value,
      pageReceipts: [...value.pageReceipts].reverse(),
    };
    const canonical = encodeFecSanitizedEnvelope(value);
    expect(encodeFecSanitizedEnvelope(reversed)).toEqual(canonical);
    expect(encodeFecSanitizedEnvelope(decodeFecSanitizedEnvelope(canonical))).toEqual(
      canonical,
    );
    const parsed = JSON.parse(Buffer.from(canonical).toString("utf8"));
    const reordered = Buffer.from(
      JSON.stringify({ adapterVersion: parsed.adapterVersion, ...parsed }),
    );
    expect(() => decodeFecSanitizedEnvelope(reordered)).toThrow(
      "FEC_ENVELOPE_NONCANONICAL",
    );
  });

  it("normalizes equivalent decimal amounts to one canonical encoding", () => {
    const value = fecEnvelopeFixture();
    const equivalent = {
      ...value,
      reports: [{ ...value.reports[0]!, cashOnHandEndPeriod: "01.0" }],
    };
    const normalized = {
      ...value,
      reports: [{ ...value.reports[0]!, cashOnHandEndPeriod: "1.00" }],
    };
    expect(encodeFecSanitizedEnvelope(equivalent)).toEqual(
      encodeFecSanitizedEnvelope(normalized),
    );
  });

  it("rejects contact fields, secret queries, and endpoint query drift", () => {
    const value = fecEnvelopeFixture();
    expect(() =>
      decodeFecSanitizedEnvelope(
        Buffer.from(
          JSON.stringify({
            ...value,
            committees: [{ ...value.committees[0], treasurerName: "Canary" }],
          }),
        ),
      ),
    ).toThrow("FEC_ENVELOPE_UNKNOWN_FIELD");
    expect(() =>
      encodeFecSanitizedEnvelope({
        ...value,
        pageReceipts: value.pageReceipts.map((page, index) =>
          index === 0
            ? { ...page, query: [...page.query, { key: "api_key", value: "secret" }] }
            : page,
        ),
      }),
    ).toThrow("FEC_QUERY_INVALID");
    expect(() =>
      encodeFecSanitizedEnvelope({
        ...value,
        pageReceipts: value.pageReceipts.map((page, index) =>
          index === 0 ? { ...page, path: "/v1/schedules/schedule_e/" } : page,
        ),
      }),
    ).toThrow("FEC_PAGE_INVALID");
  });

  it("binds receipts to canonical redacted requests", () => {
    const value = fecEnvelopeFixture();
    const page = value.pageReceipts[0]!;
    expect(fecPageRequestSha256(page.path, [...page.query].reverse())).toBe(page.requestSha256);
    expect(fecPageRequestSha256(page.path, [...page.query, { key: "api_key", value: "secret" }])).toBe(page.requestSha256);
    expect(() => encodeFecSanitizedEnvelope({ ...value, pageReceipts: [{ ...page, requestSha256: "f".repeat(64) }, ...value.pageReceipts.slice(1)] })).toThrow("FEC_REQUEST_INVALID");
  });

  it("requires terminal empty pages and exact projection closure", () => {
    const value = fecEnvelopeFixture();
    expect(() =>
      encodeFecSanitizedEnvelope({
        ...value,
        pageReceipts: value.pageReceipts.filter(
          (page) => !(page.endpoint === "schedule_e_by_candidate" && page.page === 2),
        ),
      }),
    ).toThrow("FEC_PAGINATION_INCOMPLETE");
    expect(() =>
      encodeFecSanitizedEnvelope({ ...value, outsideSpending: [] }),
    ).toThrow("FEC_PAGINATION_RECONCILIATION");
  });

  it("keeps all enumerated committees while allowing no authorized subset", () => {
    const decoded = decodeFecSanitizedEnvelope(
      encodeFecSanitizedEnvelope(fecEnvelopeWithoutAuthorizedCommittee()),
    );
    expect(decoded.committees).toHaveLength(1);
    expect(decoded.mapping.committees).toEqual([]);
    expect(decoded.reports).toEqual([]);
  });

  it("rejects unsafe money, cutoff drift, and duplicate official rows", () => {
    const value = fecEnvelopeFixture();
    expect(() =>
      encodeFecSanitizedEnvelope({
        ...value,
        reports: [
          { ...value.reports[0]!, cashOnHandEndPeriod: "9007199254740991.99" },
        ],
      }),
    ).toThrow("FEC_REPORT_INVALID");
    expect(() =>
      encodeFecSanitizedEnvelope({
        ...value,
        reports: [{ ...value.reports[0]!, receiptDate: "2025-01-01" }],
      }),
    ).toThrow("FEC_REPORT_INVALID");
    expect(() =>
      encodeFecSanitizedEnvelope({
        ...value,
        outsideSpending: [value.outsideSpending[0]!, value.outsideSpending[0]!],
      }),
    ).toThrow("FEC_OUTSIDE_SPENDING_INVALID");
  });
});
