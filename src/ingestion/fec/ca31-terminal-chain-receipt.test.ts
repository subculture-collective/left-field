/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial mutation fixtures */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCa31TerminalChainReceipt, CA31_TERMINAL_OBSERVATION_CONTRACT, validateCa31TerminalChainReceipt } from "./ca31-terminal-chain-receipt";

const entries = () => (JSON.parse(readFileSync("data/source-lock.json", "utf8")) as { entries: Array<{ id: string; sha256: string; byteSize: number }> }).entries;
describe("CA-31 terminal FEC chain receipt", () => {
  it("closes only the 2024 committee relationship while preserving the H8/H4 discrepancy", () => {
    const value = buildCa31TerminalChainReceipt(entries(), CA31_TERMINAL_OBSERVATION_CONTRACT);
    expect(value.conclusion).toMatchObject({ cycleYear: 2024, canonicalCandidateId: "H8CA39174", signedFormCandidateId: "H4CA31170", committeeId: "C00850420", disposition: "auto_verified_house_relationship", closureScope: "person_seat_cycle_and_committee_relationship_only", identifierMappingResolved: false, unresolvedIdentifierConflict: true });
    expect(value.pagination.h8Form2Page1).toMatchObject({ resultCount: 7, terminal: false });
    expect(value.pagination.h8Form2Page2).toMatchObject({ resultCount: 0, terminal: true });
    expect(value.automaticDecisionClosure).toMatchObject({ reviewerAction: false, reviewer: null, reviewedAt: null });
  });
  it("rejects altered sources, incomplete pagination, and fabricated review", () => {
    const bad = entries().map((row) => row.id === "fec-form2-ca31-20230912" ? { ...row, sha256: "0".repeat(64) } : row);
    expect(() => buildCa31TerminalChainReceipt(bad, CA31_TERMINAL_OBSERVATION_CONTRACT)).toThrow("CA31_TERMINAL_CHAIN_SOURCE_LOCK_MISMATCH");
    const observed: any = structuredClone(CA31_TERMINAL_OBSERVATION_CONTRACT); observed.form1Terminal.committeeId = "C00000000";
    expect(() => buildCa31TerminalChainReceipt(entries(), observed)).toThrow("CA31_TERMINAL_CHAIN_OBSERVED_CONTENT_MISMATCH");
    const value: any = buildCa31TerminalChainReceipt(entries(), CA31_TERMINAL_OBSERVATION_CONTRACT); value.pagination.h8Form2Page2.terminal = false;
    expect(() => validateCa31TerminalChainReceipt(value)).toThrow();
    const fabricated: any = buildCa31TerminalChainReceipt(entries(), CA31_TERMINAL_OBSERVATION_CONTRACT); fabricated.automaticDecisionClosure.reviewerAction = true;
    expect(() => validateCa31TerminalChainReceipt(fabricated)).toThrow();
  });
});
