import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RapidExpansionStatus = Readonly<{
  score: Readonly<{
    seats: number;
    localContextActiveSeats: number;
    downBallotActiveSeats: number;
    unchangedSeats: number;
    normalizedFipsSeats: number;
    partialComponentSeats: number;
    directPrimaryActiveSeats: number;
    unresolvedPrimaryRows: number;
    version: "v0.8";
    activeDistricts: readonly Readonly<{
      districtLabel: string;
      previousScore: number;
      activeScore: number;
      movement: number;
      localContext: number;
      houseMinusPresidentPercentagePoints: number;
    }>[];
  }>;
  countyOffice: Readonly<{
    officeCategories: number;
    officeRows: number;
    partyContests: number;
    candidateRows: number;
    sourceMarkedWinnerCandidates: number;
    formulaEligibleContests: 0;
  }>;
  northCarolinaLocalOffice: Readonly<{
    officeFamilies: 7;
    officeContests: 1095;
    democraticContests: 228;
    republicanContests: 546;
    nonpartisanContests: 321;
    candidateRows: 3758;
    candidateVotes: 12273926;
    formulaEligibleContests: 0;
  }>;
  newMexicoCountyOffice: Readonly<{
    officeFamilies: 6;
    officeContests: 581;
    democraticContests: 271;
    republicanContests: 302;
    libertarianContests: 8;
    candidateRows: 926;
    candidateVotes: 1967348;
    quarantinedContests: 8;
    formulaEligibleContests: 0;
  }>;
}>;

const files = {
  score: {
    id: "house-score-v08-active-projection-v1",
    path: "data/metadata/house-score-v08-active-projection-v1.json",
    bytes: 511918,
    sha256: "76fcb690ccb7abfff5c8a8b6dca844cee2da688417250192b495c5e127e1328d",
  },
  countyOffice: {
    id: "rapid-indiana-local-office-primary-results-v1",
    path: "data/metadata/rapid-indiana-local-office-primary-results-v1.json",
    bytes: 908787,
    sha256: "cd1de076b95cde9dae35cd0ed64f520e999a25c3a49be84febc9ec49b5b79209",
  },
  northCarolinaLocalOffice: {
    id: "rapid-north-carolina-local-office-primary-results-v1",
    path: "data/metadata/rapid-north-carolina-local-office-primary-results-v1.json",
    bytes: 1496876,
    sha256: "768006a4fb5e926ec6643c4c793d85ac137160946757ab9b9b91a276e7e88698",
  },
  newMexicoCountyOffice: {
    id: "rapid-new-mexico-county-office-primary-results-v1",
    path: "data/metadata/rapid-new-mexico-county-office-primary-results-v1.json",
    bytes: 954148,
    sha256: "4d1ec52441fbf07d9e9a20cd77ff27d44e1f1a33136dfb17db4372f3da24adc6",
  },
} as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
// Paths are an exact allowlist above. Ignore dynamic tracing because `root` exists only for fixture isolation.
const readAllowlisted = (path: string) =>
  readFile(/*turbopackIgnore: true*/ path);

export async function loadRapidExpansionStatus(
  root = process.cwd(),
): Promise<RapidExpansionStatus | null> {
  try {
    const [
      lockBytes,
      scoreBytes,
      countyOfficeBytes,
      northCarolinaLocalOfficeBytes,
      newMexicoCountyOfficeBytes,
    ] = await Promise.all([
      readAllowlisted(
        join(/*turbopackIgnore: true*/ root, "data/source-lock.json"),
      ),
      readAllowlisted(join(/*turbopackIgnore: true*/ root, files.score.path)),
      readAllowlisted(
        join(/*turbopackIgnore: true*/ root, files.countyOffice.path),
      ),
      readAllowlisted(
        join(
          /*turbopackIgnore: true*/ root,
          files.northCarolinaLocalOffice.path,
        ),
      ),
      readAllowlisted(
        join(/*turbopackIgnore: true*/ root, files.newMexicoCountyOffice.path),
      ),
    ]);
    const lock = JSON.parse(lockBytes.toString("utf8")) as {
      entries?: readonly {
        id?: unknown;
        retainedPath?: unknown;
        retainedStatus?: unknown;
        byteSize?: unknown;
        sha256?: unknown;
      }[];
    };
    for (const [key, bytes] of [
      ["score", scoreBytes],
      ["countyOffice", countyOfficeBytes],
      ["northCarolinaLocalOffice", northCarolinaLocalOfficeBytes],
      ["newMexicoCountyOffice", newMexicoCountyOfficeBytes],
    ] as const) {
      const file = files[key],
        matches = lock.entries?.filter((entry) => entry.id === file.id) ?? [];
      if (
        bytes.length !== file.bytes ||
        sha(bytes) !== file.sha256 ||
        matches.length !== 1 ||
        matches[0]!.retainedPath !== file.path ||
        matches[0]!.retainedStatus !== "retained" ||
        matches[0]!.byteSize !== file.bytes ||
        matches[0]!.sha256 !== file.sha256
      )
        return null;
    }
    const score = JSON.parse(scoreBytes.toString("utf8")) as {
      schema?: unknown;
      summary?: Record<string, unknown>;
      rows?: readonly Record<string, unknown>[];
    };
    const countyOffice = JSON.parse(countyOfficeBytes.toString("utf8")) as {
      schema?: unknown;
      summary?: Record<string, unknown>;
    };
    const northCarolinaLocalOffice = JSON.parse(
      northCarolinaLocalOfficeBytes.toString("utf8"),
    ) as { schema?: unknown; summary?: Record<string, unknown> };
    const newMexicoCountyOffice = JSON.parse(
      newMexicoCountyOfficeBytes.toString("utf8"),
    ) as { schema?: unknown; summary?: Record<string, unknown> };
    if (
      score.schema !== "house-score-v08-active-projection-v1" ||
      countyOffice.schema !== "rapid-indiana-local-office-primary-results-v1" ||
      northCarolinaLocalOffice.schema !==
        "rapid-north-carolina-local-office-primary-results-v1" ||
      newMexicoCountyOffice.schema !==
        "rapid-new-mexico-county-office-primary-results-v1" ||
      !score.summary ||
      !Array.isArray(score.rows) ||
      !countyOffice.summary ||
      !northCarolinaLocalOffice.summary ||
      !newMexicoCountyOffice.summary
    )
      return null;
    const active = score.rows
      .filter((row) => row.downBallotDemocraticOverperformance !== null)
      .map((row) => ({
        districtLabel: row.districtLabel as string,
        previousScore: row.previousScore as number,
        activeScore: row.activeScore as number,
        movement: row.movementFromV07 as number,
        localContext: row.localContext as number,
        houseMinusPresidentPercentagePoints:
          row.houseMinusPresidentPercentagePoints as number,
      }));
    if (
      score.summary.seats !== 430 ||
      score.summary.directPrimaryActiveSeats !== 21 ||
      score.summary.unresolvedPrimaryRows !== 1 ||
      score.summary.unchangedSeats !== 410 ||
      active.length !== 4 ||
      active.some(
        (row) =>
          !/^[A-Z]{2}-AL$/.test(row.districtLabel) ||
          ![
            row.previousScore,
            row.activeScore,
            row.movement,
            row.localContext,
            row.houseMinusPresidentPercentagePoints,
          ].every(Number.isFinite),
      )
    )
      return null;
    const expectedCounty = {
      officeCategories: 12,
      officeRows: 682,
      partyContests: 816,
      candidateRows: 1520,
      sourceMarkedWinnerCandidates: 1049,
      formulaEligibleContests: 0,
    } as const;
    if (
      Object.entries(expectedCounty).some(
        ([key, value]) => countyOffice.summary![key] !== value,
      )
    )
      return null;
    const expectedNorthCarolina = {
      officeFamilies: 7,
      officeContests: 1095,
      democraticContests: 228,
      republicanContests: 546,
      nonpartisanContests: 321,
      candidateRows: 3758,
      candidateVotes: 12273926,
      formulaEligibleContests: 0,
    } as const;
    if (
      Object.entries(expectedNorthCarolina).some(
        ([key, value]) => northCarolinaLocalOffice.summary![key] !== value,
      )
    )
      return null;
    const expectedNewMexico = {
      officeFamilies: 6,
      officeContests: 581,
      democraticContests: 271,
      republicanContests: 302,
      libertarianContests: 8,
      candidateRows: 926,
      candidateVotes: 1967348,
      quarantinedContests: 8,
      formulaEligibleContests: 0,
    } as const;
    if (
      Object.entries(expectedNewMexico).some(
        ([key, value]) => newMexicoCountyOffice.summary![key] !== value,
      )
    )
      return null;
    return {
      score: {
        seats: 430,
        localContextActiveSeats: 4,
        downBallotActiveSeats: 4,
        unchangedSeats: 410,
        normalizedFipsSeats: 1,
        partialComponentSeats: 1,
        directPrimaryActiveSeats: 21,
        unresolvedPrimaryRows: 1,
        version: "v0.8",
        activeDistricts: active,
      },
      countyOffice: expectedCounty,
      northCarolinaLocalOffice: expectedNorthCarolina,
      newMexicoCountyOffice: expectedNewMexico,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}
