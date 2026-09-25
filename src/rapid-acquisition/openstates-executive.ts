import { readRetainedSource, type SourceLock } from "./intake/source-lock";

/**
 * Open States executive roster files (CC0): one YAML document per statewide
 * officer with a party list and dated roles. The files use a small, regular
 * subset of YAML (scalar keys, lists of flat maps), so a purpose-built reader
 * is enough and avoids a dependency; anything outside that subset fails.
 */
export interface ExecutiveRole { readonly type: string; readonly startDate: string | null; readonly endDate: string | null; readonly jurisdiction: string | null }
export interface ExecutivePerson { readonly id: string; readonly name: string; readonly givenName: string | null; readonly familyName: string | null; readonly parties: readonly string[]; readonly roles: readonly ExecutiveRole[]; readonly sourceId: string }

const fail = (code: string): never => { throw new Error(`OPENSTATES_EXECUTIVE_${code}`); };
const scalar = (value: string): string => { const trimmed = value.trim(); return /^'.*'$/.test(trimmed) ? trimmed.slice(1, -1).replace(/''/g, "'") : /^".*"$/.test(trimmed) ? JSON.parse(trimmed) as string : trimmed; };

/** Parses the top-level scalar keys plus the `party` and `roles` lists. Other keys are skipped. */
export function parseExecutiveYaml(text: string, sourceId: string): ExecutivePerson {
  const top: Record<string, string> = {};
  const lists: Record<string, Record<string, string>[]> = {};
  let current: string | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const topMatch = line.match(/^([a-z_]+):(.*)$/);
    if (topMatch) {
      const [, key, rest] = topMatch;
      if (rest!.trim() === "") { current = key!; lists[key!] ??= []; } else { current = null; top[key!] = scalar(rest!); }
      continue;
    }
    if (current === null || (current !== "party" && current !== "roles")) continue; // offices, links, ids, sources: not read
    const item = line.match(/^- ([a-z_]+): ?(.*)$/);
    if (item) { lists[current]!.push({ [item[1]!]: scalar(item[2]!) }); continue; }
    const field = line.match(/^  ([a-z_]+): ?(.*)$/);
    if (field) { const last = lists[current]![lists[current]!.length - 1]; if (!last) fail(`LIST_SHAPE:${sourceId}`); last![field[1]!] = scalar(field[2]!); continue; }
    if (/^[-\s]/.test(line)) continue; // nested detail we do not read (offices, links, sources)
    fail(`LINE_UNREADABLE:${sourceId}:${line.slice(0, 40)}`);
  }
  if (!top.id || !top.name) fail(`IDENTITY_MISSING:${sourceId}`);
  return {
    id: top.id!, name: top.name!, givenName: top.given_name ?? null, familyName: top.family_name ?? null,
    parties: (lists.party ?? []).map((row) => row.name ?? fail(`PARTY_SHAPE:${sourceId}`)),
    roles: (lists.roles ?? []).map((row) => ({ type: row.type ?? fail(`ROLE_SHAPE:${sourceId}`), startDate: row.start_date ?? null, endDate: row.end_date ?? null, jurisdiction: row.jurisdiction ?? null })),
    sourceId,
  };
}

export function readStateExecutives(lock: SourceLock, ids: readonly string[], root = process.cwd()): ExecutivePerson[] {
  return ids.map((id) => parseExecutiveYaml(readRetainedSource(lock, id, root).bytes.toString("utf8"), id));
}
