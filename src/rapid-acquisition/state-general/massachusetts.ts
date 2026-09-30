import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Massachusetts Secretary of the Commonwealth, certified election statistics
 * (electionstats.state.ma.us). The site has no bulk export; its election
 * search page for an office and year lists every contest with a full
 * candidate table (candidate, party, district-wide votes, "All Others" for
 * write-ins, "Blanks", "Total Votes Cast"). The House (office 8) and Senate
 * (office 9) search pages for 2024 are retained as served and parsed here.
 * Both chambers serve two-year terms. The House page also lists a special
 * general election (6th Worcester), which is skipped because the regular
 * general supersedes it. Senate district names write "&" and "1st" where
 * the roster writes "and" and "First".
 */
const SOURCES: readonly (StateGeneralSource & { chamber: "upper" | "lower"; office: string })[] = [
  { id: "ma-2024-general-house-search-html", url: "https://electionstats.state.ma.us/elections/search/year_from:2024/year_to:2024/office_id:8/stage:General", path: "data/source/rapid/state-general/ma/2024-general-house-search.html", cycleYear: 2024, electionDate: "2024-11-05", note: "160 House general contests and one special.", chamber: "lower", office: "State Representative" },
  { id: "ma-2024-general-senate-search-html", url: "https://electionstats.state.ma.us/elections/search/year_from:2024/year_to:2024/office_id:9/stage:General", path: "data/source/rapid/state-general/ma/2024-general-senate-search.html", cycleYear: 2024, electionDate: "2024-11-05", note: "40 Senate contests.", chamber: "upper", office: "State Senate" },
];

const fail = (code: string): never => { throw new Error(`MASSACHUSETTS_GENERAL_${code}`); };
/** The roster spells leading Senate ordinals as words ("First Middlesex"); House districts keep "1st". */
const ORDINAL_WORDS: Readonly<Record<number, string>> = { 1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth", 6: "Sixth", 7: "Seventh", 8: "Eighth", 9: "Ninth" };
const integer = (value: string): number => { const trimmed = value.replace(/,/g, "").trim(); return /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };
const text = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, "\"").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const spec = SOURCES.find((candidate) => candidate.id === source.id) ?? fail(`SOURCE_UNKNOWN:${source.id}`);
  const html = bytes.toString("utf8");
  const contests: RawGeneralContest[] = [];
  for (const match of html.matchAll(/<tr id="election-id-(\d+)" class="election_item[^"]*">([\s\S]*?)<!--\/\/ END tr#election-id-\.\.\. \/\/-->/g)) {
    const body = match[2]!;
    const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].slice(0, 4).map((cell) => text(cell[1]!));
    const [, office, district, stage] = cells;
    if (office !== spec.office) fail(`OFFICE_MISMATCH:${match[1]}:${office}`);
    if (stage !== "General Election") continue;
    const table = body.match(/<table class="candidates"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? fail(`CANDIDATES_MISSING:${match[1]}`);
    const candidates = [...table.matchAll(/<tr class="([^"]*)">([\s\S]*?)<\/tr>/g)].flatMap((row) => {
      const classes = row[1]!, cellsHtml = row[2]!;
      if (/n_blank_votes|n_total_votes|more_info/.test(classes)) return [];
      const numbers = [...cellsHtml.matchAll(/<td class="number">([\s\S]*?)<\/td>/g)].map((cell) => text(cell[1]!));
      if (/n_all_other_votes/.test(classes)) return [{ name: "All Others", rawParty: "", votes: integer(numbers[0] ?? ""), writeIn: true }];
      const name = text(cellsHtml.match(/<div class="name">([\s\S]*?)<\/div>/)?.[1] ?? fail(`NAME_MISSING:${match[1]}`));
      const party = text(cellsHtml.match(/<div class="party">([\s\S]*?)<\/div>/)?.[1] ?? "");
      return [{ name, rawParty: party, votes: integer(numbers[0] ?? ""), writeIn: false }];
    });
    const name = district!.replace(/\s*&\s*/g, " and ");
    contests.push({ chamber: spec.chamber, district: spec.chamber === "upper" ? name.replace(/^(\d)(?:st|nd|rd|th)\b/, (_match, digit: string) => ORDINAL_WORDS[Number(digit)] ?? fail(`ORDINAL:${name}`)) : name, candidates });
  }
  return contests;
}

export const MASSACHUSETTS_GENERAL: StateGeneralAdapter = {
  stateCode: "MA",
  authority: "Massachusetts Secretary of the Commonwealth, certified election statistics",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note }) => ({ id, url, path, cycleYear, electionDate, note })),
  expectedContests: { "ma-2024-general-house-search-html": 160, "ma-2024-general-senate-search-html": 40 },
  parse,
};
