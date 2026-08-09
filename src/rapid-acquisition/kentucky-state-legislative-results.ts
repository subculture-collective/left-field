import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Candidate = Readonly<{
  sourceCandidateKey: string;
  sourceName: string;
  votes: number;
}>;
export interface KentuckyStateLegislativeContest {
  readonly contestId: string;
  readonly cycleYear: 2022 | 2024 | 2026;
  readonly electionDate: "2022-05-17" | "2024-05-21" | "2026-05-19";
  readonly chamber: "upper" | "lower";
  readonly district: string;
  readonly rawParty: "Democratic" | "Republican";
  readonly candidates: readonly Candidate[];
  readonly totalVotes: number;
  readonly resultAuthorityStatus: "official_secretary_primary_results_pdf_retained";
  readonly certificationStatus:
    | "official_results_pdf_separate_candidate_certification_not_retained"
    | "official_statewide_vote_totals_certification_pdf_retained";
  readonly sourceWinnerStatus: "not_marked_by_source";
  readonly winnerIdentity: null;
  readonly identity: null;
  readonly sourceLockIds: readonly string[];
  readonly formulaEligible: false;
  readonly contestSha256: string;
}
type CycleSummary = Readonly<{
  cycleYear: 2022 | 2024 | 2026;
  reportedPartyContests: number;
  candidateRows: number;
  candidateVotes: number;
}>;
export interface KentuckyStateLegislativeResults {
  readonly schema: "rapid-kentucky-state-legislative-primary-results-v1";
  readonly version: 1;
  readonly extraction: "pdftotext_tsv_26_07_0_coordinate_columns";
  readonly contests: readonly KentuckyStateLegislativeContest[];
  readonly cycles: readonly CycleSummary[];
  readonly contestSetSha256: string;
  readonly summary: Readonly<{
    cycles: 3;
    reportedPartyContests: 134;
    upperChamberContests: 25;
    lowerChamberContests: 109;
    democraticContests: 43;
    republicanContests: 91;
    candidateRows: 298;
    candidateVotes: 689016;
    formulaEligibleContests: 0;
  }>;
  readonly packageSha256: string;
}
const SOURCES = [
  {
    year: 2022 as const,
    date: "2022-05-17" as const,
    pdf: {
      id: "ky-2022-primary-results",
      path: "data/source/rapid/house-primary/ky/2022/primary-results.pdf",
      bytes: 221391,
      sha: "385848ad3fd60c221d299cc8d75abc7bb646c96fdfa8e3ab21327590aaff0253",
    },
    tsv: {
      id: "ky-2022-primary-results-tsv-text",
      path: "data/source/rapid/house-primary/ky/2022/primary-results-tsv.txt",
      bytes: 572474,
      sha: "261a6f4598e7d8824cac99ccdc291fc9171c40333f1a351d0c0f3cf3b1a050b3",
    },
    contests: 54,
    candidates: 116,
    votes: 274179,
  },
  {
    year: 2024 as const,
    date: "2024-05-21" as const,
    pdf: {
      id: "ky-2024-primary-results",
      path: "data/source/rapid/house-primary/ky/2024/primary-results.pdf",
      bytes: 211411,
      sha: "9308e1c41742ab18cd8b9a28b0b6fc3d2318515a1ce9f4eec7b869b3d01f39d8",
    },
    tsv: {
      id: "ky-2024-primary-results-tsv-text",
      path: "data/source/rapid/house-primary/ky/2024/primary-results-tsv.txt",
      bytes: 614858,
      sha: "434738afc72012ecd7b44fd086c33ecfeeb5745329d8edaee1eb04268f27a1c7",
    },
    contests: 41,
    candidates: 92,
    votes: 180152,
  },
  {
    year: 2026 as const,
    date: "2026-05-19" as const,
    pdf: {
      id: "ky-2026-primary-certification-vote-totals",
      path: "data/source/rapid/house-primary/ky/2026/primary-certification-vote-totals.pdf",
      bytes: 221811,
      sha: "e69458bae9bcce14f4aa22b3394ff0d47f9c5c9f8bd2915be1650519fdd8cd9c",
    },
    tsv: {
      id: "ky-2026-primary-certification-vote-totals-tsv-text",
      path: "data/source/rapid/house-primary/ky/2026/primary-certification-vote-totals-tsv.txt",
      bytes: 873018,
      sha: "8482d375ecc509e6a776f407ebb15a26357a24c6ad29d28c7e48bc5ddec48765",
    },
    contests: 39,
    candidates: 90,
    votes: 234685,
  },
] as const;
type Word = {
  page: number;
  left: number;
  top: number;
  width: number;
  text: string;
};
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0),
  canonical = (v: unknown): string =>
    v === null || typeof v !== "object"
      ? JSON.stringify(v)
      : Array.isArray(v)
        ? `[${v.map(canonical).join(",")}]`
        : `{${Object.keys(v as object)
            .sort(cmp)
            .map(
              (k) =>
                `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`,
            )
            .join(",")}}`,
  hash = (d: string, v: unknown) =>
    createHash("sha256")
      .update(`${d}\0${canonical(v)}`)
      .digest("hex"),
  fileSha = (v: Buffer) => createHash("sha256").update(v).digest("hex"),
  fail = (c: string): never => {
    throw new Error(`KENTUCKY_STATE_LEGISLATIVE_${c}`);
  },
  near = (a: number, b: number, t = 0.4) => Math.abs(a - b) < t;
function parseWords(bytes: Buffer): Word[] {
  const lines = bytes.toString("utf8").split("\n");
  if (!lines.shift()?.startsWith("level\tpage_num")) fail("TSV_HEADER_INVALID");
  return lines.flatMap((line) => {
    if (!line) return [];
    const f = line.split("\t");
    if (f[0] !== "5") return [];
    const word = {
      page: Number(f[1]),
      left: Number(f[6]),
      top: Number(f[7]),
      width: Number(f[8]),
      text: f.slice(11).join("\t"),
    };
    if (
      ![word.page, word.left, word.top, word.width].every(Number.isFinite) ||
      !word.text
    )
      fail("TSV_WORD_INVALID");
    return [word];
  });
}
function parse(
  bytes: Buffer,
  source: (typeof SOURCES)[number],
): KentuckyStateLegislativeContest[] {
  const pages = new Map<number, Word[]>();
  for (const word of parseWords(bytes))
    pages.set(word.page, [...(pages.get(word.page) ?? []), word]);
  const contests: KentuckyStateLegislativeContest[] = [];
  for (const [page, pageWords] of pages) {
    const titles = pageWords.filter(
      (word) =>
        word.text === "State" &&
        pageWords.some(
          (other) =>
            near(other.top, word.top, 0.3) &&
            ["Senator", "Representative"].includes(other.text),
        ),
    );
    for (const title of titles) {
      const next = Math.min(
          ...titles
            .filter((item) => item.top > title.top + 1)
            .map((item) => item.top),
          Number.POSITIVE_INFINITY,
        ),
        block = pageWords.filter(
          (word) => word.top >= title.top - 0.5 && word.top < next,
        ),
        chamber = block.some(
          (word) => near(word.top, title.top, 0.3) && word.text === "Senator",
        )
          ? ("upper" as const)
          : ("lower" as const),
        descriptor = block.find(
          (word) =>
            /^(Senatorial|Representative)$/.test(word.text) &&
            block.some(
              (other) =>
                near(other.top, word.top, 0.3) &&
                /^\d+(st|nd|rd|th)$/.test(other.text),
            ),
        ),
        districtWord =
          descriptor &&
          block.find(
            (word) =>
              near(word.top, descriptor.top, 0.3) &&
              /^\d+(st|nd|rd|th)$/.test(word.text),
          ),
        partyWord = block.find(
          (word) =>
            ["Democratic", "Republican"].includes(word.text) &&
            block.some(
              (other) =>
                near(other.top, word.top, 0.3) && other.text === "Party",
            ),
        ),
        totalWord = block.find(
          (word) =>
            word.text === "Total" &&
            block.some(
              (other) =>
                near(other.top, word.top, 0.3) && other.text === "Votes",
            ),
        );
      if (!descriptor && !districtWord && !partyWord && !totalWord) continue;
      if (!descriptor || !districtWord || !partyWord || !totalWord)
        fail(`TABLE_STRUCTURE_INVALID:${source.year}:${page}:${title.top}`);
      const guardedDistrictWord = districtWord!,
        guardedPartyWord = partyWord!,
        guardedTotalWord = totalWord!;
      const values = block
          .filter(
            (word) =>
              near(word.top, guardedTotalWord.top) &&
              word.left > 100 &&
              /^\d[\d,]*$/.test(word.text),
          )
          .sort((a, b) => a.left - b.left),
        firstDataTop = Math.min(
          ...block
            .filter(
              (word) =>
                word.top > guardedPartyWord.top + 2 &&
                word.top < guardedTotalWord.top &&
                /^\d[\d,]*$/.test(word.text),
            )
            .map((word) => word.top),
        ),
        groups = values.map(() => [] as Word[]);
      for (const word of block.filter(
        (item) =>
          item.top > guardedPartyWord.top + 2 &&
          item.top < firstDataTop - 1 &&
          item.left > 100,
      )) {
        let selected = 0,
          distance = Number.POSITIVE_INFINITY;
        values.forEach((value, index) => {
          const candidateDistance = Math.abs(
            word.left + word.width / 2 - (value.left + value.width / 2),
          );
          if (candidateDistance < distance) {
            distance = candidateDistance;
            selected = index;
          }
        });
        groups[selected]!.push(word);
      }
      const candidates = groups.map((group, index) => ({
        sourceCandidateKey: `${page}:${title.top.toFixed(2)}:${index + 1}`,
        sourceName: group
          .sort((a, b) => a.top - b.top || a.left - b.left)
          .map((word) => word.text)
          .join(" "),
        votes: Number(values[index]!.text.replace(/,/g, "")),
      }));
      if (
        !candidates.length ||
        candidates.some((candidate) => !candidate.sourceName) ||
        new Set(candidates.map((candidate) => candidate.sourceName)).size !==
          candidates.length
      )
        fail("CANDIDATE_INVALID");
      const rawParty = guardedPartyWord.text as "Democratic" | "Republican",
        district = guardedDistrictWord.text
          .replace(/\D/g, "")
          .padStart(chamber === "upper" ? 2 : 3, "0"),
        unsigned = {
          contestId: `ky:state-leg-primary:${source.year}:${chamber}:${district}:${rawParty === "Democratic" ? "DEM" : "REP"}`,
          cycleYear: source.year,
          electionDate: source.date,
          chamber,
          district,
          rawParty,
          candidates,
          totalVotes: candidates.reduce((sum, row) => sum + row.votes, 0),
          resultAuthorityStatus:
            "official_secretary_primary_results_pdf_retained" as const,
          certificationStatus:
            source.year === 2026
              ? ("official_statewide_vote_totals_certification_pdf_retained" as const)
              : ("official_results_pdf_separate_candidate_certification_not_retained" as const),
          sourceWinnerStatus: "not_marked_by_source" as const,
          winnerIdentity: null,
          identity: null,
          sourceLockIds: [source.pdf.id, source.tsv.id],
          formulaEligible: false as const,
        };
      contests.push({
        ...unsigned,
        contestSha256: hash(
          "dsa-seats:rapid-kentucky-state-legislative-contest:v1",
          unsigned,
        ),
      });
    }
  }
  contests.sort(
    (a, b) =>
      cmp(a.chamber, b.chamber) ||
      cmp(a.district, b.district) ||
      cmp(a.rawParty, b.rawParty),
  );
  if (
    contests.length !== source.contests ||
    contests.reduce((s, r) => s + r.candidates.length, 0) !==
      source.candidates ||
    contests.reduce((s, r) => s + r.totalVotes, 0) !== source.votes
  )
    fail(`CYCLE_CLOSURE_INVALID:${source.year}`);
  return contests;
}
export function buildKentuckyStateLegislativeResults(
  root = process.cwd(),
): KentuckyStateLegislativeResults {
  const lock = JSON.parse(
      readFileSync(join(root, "data/source-lock.json"), "utf8"),
    ) as {
      entries: readonly {
        id: string;
        retainedPath?: string;
        byteSize?: number;
        sha256?: string;
      }[];
    },
    contests: KentuckyStateLegislativeContest[] = [],
    cycles: CycleSummary[] = [];
  for (const source of SOURCES) {
    for (const pin of [source.pdf, source.tsv]) {
      const bytes = readFileSync(join(root, pin.path)),
        entry = lock.entries.find((row) => row.id === pin.id);
      if (
        bytes.length !== pin.bytes ||
        fileSha(bytes) !== pin.sha ||
        !entry ||
        entry.retainedPath !== pin.path ||
        entry.byteSize !== pin.bytes ||
        entry.sha256 !== pin.sha
      )
        fail(`SOURCE_INVALID:${pin.id}`);
    }
    const parsed = parse(readFileSync(join(root, source.tsv.path)), source);
    contests.push(...parsed);
    cycles.push({
      cycleYear: source.year,
      reportedPartyContests: source.contests,
      candidateRows: source.candidates,
      candidateVotes: source.votes,
    });
  }
  contests.sort(
    (a, b) =>
      a.cycleYear - b.cycleYear ||
      cmp(a.chamber, b.chamber) ||
      cmp(a.district, b.district) ||
      cmp(a.rawParty, b.rawParty),
  );
  const summary = {
      cycles: 3 as const,
      reportedPartyContests: 134 as const,
      upperChamberContests: 25 as const,
      lowerChamberContests: 109 as const,
      democraticContests: 43 as const,
      republicanContests: 91 as const,
      candidateRows: 298 as const,
      candidateVotes: 689016 as const,
      formulaEligibleContests: 0 as const,
    },
    actual = {
      cycles: cycles.length,
      reportedPartyContests: contests.length,
      upperChamberContests: contests.filter((r) => r.chamber === "upper")
        .length,
      lowerChamberContests: contests.filter((r) => r.chamber === "lower")
        .length,
      democraticContests: contests.filter((r) => r.rawParty === "Democratic")
        .length,
      republicanContests: contests.filter((r) => r.rawParty === "Republican")
        .length,
      candidateRows: contests.reduce((s, r) => s + r.candidates.length, 0),
      candidateVotes: contests.reduce((s, r) => s + r.totalVotes, 0),
      formulaEligibleContests: 0,
    };
  if (canonical(actual) !== canonical(summary)) fail("SUMMARY_INVALID");
  const contestSetSha256 = hash(
      "dsa-seats:rapid-kentucky-state-legislative-contest-set:v1",
      contests,
    ),
    unsigned = {
      schema: "rapid-kentucky-state-legislative-primary-results-v1" as const,
      version: 1 as const,
      extraction: "pdftotext_tsv_26_07_0_coordinate_columns" as const,
      contests,
      cycles,
      contestSetSha256,
      summary,
    };
  return {
    ...unsigned,
    packageSha256: hash(
      "dsa-seats:rapid-kentucky-state-legislative-package:v1",
      unsigned,
    ),
  };
}
export function validateKentuckyStateLegislativeResults(
  value: unknown,
  root = process.cwd(),
): KentuckyStateLegislativeResults {
  const expected = buildKentuckyStateLegislativeResults(root);
  if (canonical(value) !== canonical(expected))
    throw new Error("KENTUCKY_STATE_LEGISLATIVE_RESULTS_INVALID");
  return value as KentuckyStateLegislativeResults;
}
