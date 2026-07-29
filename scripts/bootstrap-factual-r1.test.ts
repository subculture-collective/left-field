import { describe, expect, it, vi } from "vitest";
import { executeBootstrapFactualR1, main, parseBootstrapFactualR1Arguments } from "./bootstrap-factual-r1";

type Query = { readonly text: string; readonly values?: readonly unknown[] };
const argv = ["--release", "rel_r1_20260718", "--label", "Factual R1 2026-07-18", "--cutoff", "2026-07-18"];
const release = {
  id: "rel_r1_20260718",
  label: "Factual R1 2026-07-18",
  status: "candidate",
  source_cutoff: "2026-07-18T00:00:00.000Z",
  published_at: null,
  previous_release_id: null,
};
const sources = [
  { id: "src_identity", name: "identity", authority: "derived", homepage_url: "https://clerk.house.gov/" },
  { id: "src_tiger", name: "tiger", authority: "derived", homepage_url: "https://www.census.gov/" },
];

function fakePool(options: { readonly release?: object | null; readonly sources?: readonly object[]; readonly residue?: boolean } = {}) {
  const queries: Query[] = [];
  const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
    queries.push({ text, values });
    if (text.startsWith("SELECT id,label,status")) {
      const row = options.release === undefined ? release : options.release;
      return { rowCount: row === null ? 0 : 1, rows: row === null ? [] : [row] };
    }
    if (text.startsWith("SELECT id,name,authority")) return { rowCount: (options.sources ?? sources).length, rows: options.sources ?? sources };
    if (text.includes(" AS found")) return { rowCount: 1, rows: [{ found: options.residue ?? false }] };
    return { rowCount: 1, rows: [] };
  });
  const client = { query, release: vi.fn() };
  return { connect: vi.fn(async () => client), queries, client };
}

describe("factual R1 bootstrap CLI", () => {
  it("parses only the fixed factual release contract", () => {
    expect(parseBootstrapFactualR1Arguments(argv)).toEqual({ release: "rel_r1_20260718", label: "Factual R1 2026-07-18", cutoff: "2026-07-18" });
    for (const invalid of [
      [...argv, "--label", "duplicate"],
      ["--release", "bad", "--label", "Factual", "--cutoff", "2026-07-18"],
      ["--release", "rel_a", "--label", "Factual", "--cutoff", "2026-07-19"],
      ["--release", "rel_a", "--label", " Factual", "--cutoff", "2026-07-18"],
    ]) expect(() => parseBootstrapFactualR1Arguments(invalid)).toThrow();
  });

  it("atomically creates only the candidate shell and exact derived sources", async () => {
    const pool = fakePool({ release: null });
    const result = await executeBootstrapFactualR1(argv, { getPool: () => pool as never, now: () => new Date("2026-07-28T18:30:00Z") });
    expect(result).toEqual({ release: "rel_r1_20260718", label: "Factual R1 2026-07-18", cutoff: "2026-07-18", status: "created", sources: ["identity", "tiger"] });
    expect(pool.queries.find(({ text }) => text.startsWith("INSERT INTO data_releases"))?.values).toEqual(["rel_r1_20260718", "Factual R1 2026-07-18", "2026-07-18T00:00:00.000Z", "2026-07-28T18:30:00.000Z"]);
    expect(pool.queries.some(({ text }) => text.startsWith("INSERT INTO sources"))).toBe(true);
    expect(pool.queries.some(({ text }) => /published|retired/.test(text) && text.startsWith("UPDATE"))).toBe(false);
    expect(pool.queries.at(-1)?.text).toBe("COMMIT");
  });

  it("is an exact, read-only retry for an empty matching candidate", async () => {
    const pool = fakePool();
    await expect(executeBootstrapFactualR1(argv, { getPool: () => pool as never })).resolves.toMatchObject({ status: "already_prepared" });
    expect(pool.queries.some(({ text }) => /^(INSERT|UPDATE|DELETE)/.test(text))).toBe(false);
    expect(pool.queries.some(({ text }) => text.includes(" AS found"))).toBe(true);
  });

  it("rejects mismatched metadata, sources, or any staged residue", async () => {
    await expect(executeBootstrapFactualR1(argv, { getPool: () => fakePool({ release: { ...release, label: "Other" } }) as never })).rejects.toThrow("does not match");
    await expect(executeBootstrapFactualR1(argv, { getPool: () => fakePool({ sources: [sources[0]!] }) as never })).rejects.toThrow("sources");
    await expect(executeBootstrapFactualR1(argv, { getPool: () => fakePool({ residue: true }) as never })).rejects.toThrow("staged or finalized");
  });

  it("rolls back failures and emits stable non-secret JSON", async () => {
    const failing = fakePool({ release: { ...release, status: "published" } });
    await expect(executeBootstrapFactualR1(argv, { getPool: () => failing as never })).rejects.toThrow();
    expect(failing.queries.at(-1)?.text).toBe("ROLLBACK");
    const stdout = { write: vi.fn() };
    await main(argv, { getPool: () => fakePool() as never, stdout });
    expect(stdout.write).toHaveBeenCalledWith('{"release":"rel_r1_20260718","label":"Factual R1 2026-07-18","cutoff":"2026-07-18","status":"already_prepared","sources":["identity","tiger"]}\n');
  });
});
