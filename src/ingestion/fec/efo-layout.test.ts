import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { encodeFecEfoLayouts, isValidatedFecEfoLayout, loadFecEfoLayouts } from "./efo-layout";

const hash = "c667016493df28c186445201cf8a2bcff43563bccc41b75b2bcc06366b69132b";
const fixture = () => readFile("data/metadata/fec-efo-layouts-v1.json");
type HdrField = "recordType" | "efType" | "fecVersion" | "reportId" | "reportNumber";
type ProvenanceLayout = { hdr: Record<HdrField, number>; delimiter: { source: string }; evidence: { observed: string; specification: string } };
const canonicalMutation = (document: object, mutate: (copy: ProvenanceLayout) => void): Uint8Array => {
  const copy = structuredClone(document) as ProvenanceLayout; mutate(copy); return encodeFecEfoLayouts(copy);
};
describe("FEC EFO layout contract", () => {
  it("binds all verified variants and explicit absences", async () => { const layout = loadFecEfoLayouts(await fixture(), hash); expect(layout.hdr).toEqual({ fecVersion: 3, efType: 2, recordType: 1, reportId: 6, reportNumber: 7 }); expect(layout.coverRecords.F3X[1]).toMatchObject({ recordType: "F3XN", fields: { reportCode: 10, electionCode: 11, coverageFromDate: 14, dateSigned: 22, originalAmendmentDate: null } }); expect(layout.coverRecords.F24[1]).toMatchObject({ recordType: "F24N", fields: { report24Hour48HourCode: 3, originalAmendmentDate: 4, reportCode: null } }); expect(layout.coverRecords.F5[0]).toMatchObject({ recordType: "F5A", fields: { reportCode: 18, report24Hour48HourCode: 19, dateSigned: 30, electionCode: null } }); });
  it("brands only immutable loader-issued layouts", async () => { const layout = loadFecEfoLayouts(await fixture(), hash); expect(isValidatedFecEfoLayout(layout)).toBe(true); expect(Object.isFrozen(layout)).toBe(true); expect(isValidatedFecEfoLayout(structuredClone(layout))).toBe(false); });
  it("has ordinary SE and F57 semantics", async () => { const layout = loadFecEfoLayouts(await fixture(), hash); expect(layout.scheduleERecords.F3X[0]).toMatchObject({ recordType: "SE", fields: { electionCode: 18, memoCode: 43 } }); expect(layout.scheduleERecords.F5[0]).toEqual({ recordType: "F57", fields: { amount: 19, backReferenceSchedule: null, backReferenceTransactionId: null, candidateId: 25, disseminationDate: 18, electionCode: 16, expenditureDate: null, filerId: 2, formType: 1, memoCode: null, supportOppose: 24, transactionId: 3 } }); });
  it("requires canonical bounded workbook-bound bytes", async () => { const bytes = await fixture(), document = JSON.parse(Buffer.from(bytes).toString()) as { coverRecords: { F3: unknown[] }; extra?: boolean }; expect(encodeFecEfoLayouts(document)).toEqual(bytes); expect(() => loadFecEfoLayouts(bytes, "0".repeat(64))).toThrow("FEC_EFO_LAYOUT_UNSUPPORTED"); const unsorted = structuredClone(document); [unsorted.coverRecords.F3[0], unsorted.coverRecords.F3[1]] = [unsorted.coverRecords.F3[1]!, unsorted.coverRecords.F3[0]!]; const extra = structuredClone(document); extra.extra = true; for (const mutant of [Buffer.from(`${Buffer.from(bytes).toString()} `), Buffer.from(Buffer.from(bytes).toString().replace('"schemaVersion":1', '"schemaVersion":"1"')), Buffer.from(Buffer.from(bytes).toString().replace('"recordType":"F3A"', '"recordType":"F3N"')), encodeFecEfoLayouts(unsorted), encodeFecEfoLayouts(extra)]) expect(() => loadFecEfoLayouts(mutant, hash)).toThrow(); expect(() => loadFecEfoLayouts(new Uint8Array(65537), hash)).toThrow(); });
  it("rejects canonical HDR position and provenance mutants", async () => {
    const document = JSON.parse(Buffer.from(await fixture()).toString()) as object;
    const hdrFields: readonly HdrField[] = ["recordType", "efType", "fecVersion", "reportId", "reportNumber"];
    for (const field of hdrFields) {
      const mutant = canonicalMutation(document, copy => { copy.hdr[field] += 1; });
      expect(() => loadFecEfoLayouts(mutant, hash)).toThrow("FEC_EFO_LAYOUT_INVALID");
    }
    for (const mutate of [
      (copy: ProvenanceLayout) => { copy.delimiter.source = "https://example.test/"; },
      (copy: ProvenanceLayout) => { copy.evidence.observed = "different observed claim"; },
      (copy: ProvenanceLayout) => { copy.evidence.specification = "different specification claim"; },
    ]) expect(() => loadFecEfoLayouts(canonicalMutation(document, mutate), hash)).toThrow("FEC_EFO_LAYOUT_UNSUPPORTED");
  });
});
