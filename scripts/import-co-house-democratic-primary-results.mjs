import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.CO_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) throw new Error("CO_PRIMARY_IMPORT_DIR_REQUIRED: provide the exact official Colorado source capture bundle");

const sources = [
  { input: "2022-certification-announcement.html", output: "data/source/elections/primary-results/colorado/2022/certification-announcement.html", byteSize: 31_898, sha256: "68844cf221707fd6460bfdcc7b442b9e1dc2db41ea7be49ad4483e66ab2ad5c6" },
  { input: "2022-state-primary-certificate.pdf", output: "data/source/elections/primary-results/colorado/2022/state-primary-certificate-and-statewide-abstract.pdf", byteSize: 665_510, sha256: "b6d17a430a10bfd55bcaf7fa05a20689bb67020026d0ef75dd5247f015ecc004" },
  { input: "2022-democratic-us-house.html", output: "data/source/elections/primary-results/colorado/2022/democratic-us-house-official-abstract.html", byteSize: 51_812, sha256: "44f1b5bad3cabf2370e6996dc0680736ad237fe780ba03ae913e44428898d149" },
  { input: "2024-biennial-abstract.pdf", output: "data/source/elections/primary-results/colorado/2024/2024-biennial-abstract.pdf", byteSize: 3_804_176, sha256: "68f9513cced12bf82b651bae9bc641e594ac0b5441670306eb07b9a158ed23f5" },
  { input: "2026-state-primary-abstract.pdf", output: "data/source/elections/primary-results/colorado/2026/state-primary-signed-statewide-abstract.pdf", byteSize: 646_208, sha256: "807e10067804ca143853d15d13c8a0807dde64aed918a645ffd9428f035ff7aa" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const verify = (label, bytes, expected) => { if (bytes.length !== expected.byteSize || sha(bytes) !== expected.sha256) throw new Error(`CO_PRIMARY_SOURCE_DRIFT:${label}`); };
async function writeExact(path, bytes) { await mkdir(dirname(path), { recursive: true }); try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error?.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`CO_PRIMARY_OUTPUT_CONFLICT:${path}`); } }
const integer = (value) => { const normalized = value.replaceAll(",", ""); if (!/^(?:0|[1-9]\d*)$/.test(normalized)) throw new Error(`CO_PRIMARY_INTEGER_INVALID:${value}`); return Number(normalized); };

const candidates2024 = {
  "01": [["Diana DeGette", "named_candidate"], ["John Wren", "named_write_in"]],
  "02": [["Joe Neguse", "named_candidate"]],
  "03": [["Adam Frisch", "named_candidate"]],
  "04": [["Trisha Calvarese", "named_candidate"], ["John Padora Jr.", "named_candidate"], ["Ike McCorkle", "named_candidate"]],
  "05": [["River Gassen", "named_candidate"], ["Joe Reagan", "named_candidate"]],
  "06": [["Jason Crow", "named_candidate"]],
  "07": [["Brittany Pettersen", "named_candidate"]],
  "08": [["Yadira Caraveo", "named_candidate"]],
};
const countyCounts = { "01": 3, "02": 12, "03": 27, "04": 21, "05": 1, "06": 5, "07": 11, "08": 3 };

function validateTables(tables, year) {
  if (tables.length !== 8 || tables.some((table, index) => table.districtCode !== String(index + 1).padStart(2, "0"))) throw new Error(`CO_PRIMARY_${year}_DISTRICT_CLOSURE_INVALID`);
  for (const table of tables) {
    if (table.countyRows.length !== countyCounts[table.districtCode] || new Set(table.countyRows.map((row) => row.county)).size !== table.countyRows.length) throw new Error(`CO_PRIMARY_${year}_${table.districtCode}_COUNTY_CLOSURE_INVALID`);
    if (table.countyRows.some((row) => row.votes.length !== table.candidates.length || row.votes.reduce((sum, votes) => sum + votes, 0) !== row.sourceTotalVotes)) throw new Error(`CO_PRIMARY_${year}_${table.districtCode}_COUNTY_RECONCILIATION_INVALID`);
    for (let candidate = 0; candidate < table.candidates.length; candidate++) if (table.candidates[candidate].votes !== table.countyRows.reduce((sum, row) => sum + row.votes[candidate], 0)) throw new Error(`CO_PRIMARY_${year}_${table.districtCode}_CANDIDATE_RECONCILIATION_INVALID`);
    if (table.sourceTotalVotes !== table.candidates.reduce((sum, candidate) => sum + candidate.votes, 0)) throw new Error(`CO_PRIMARY_${year}_${table.districtCode}_TOTAL_RECONCILIATION_INVALID`);
  }
  return tables;
}

function parse2024(text) {
  const tables = [];
  for (let district = 1; district <= 8; district++) {
    const districtCode = String(district).padStart(2, "0"), heading = `Representative to the 119th United States Congress - District ${district}`, start = text.indexOf(heading);
    if (start < 0) throw new Error(`CO_PRIMARY_2024_${districtCode}_HEADING_MISSING`);
    const nextHeading = district < 8 ? text.indexOf(`Representative to the 119th United States Congress - District ${district + 1}`, start + heading.length) : text.indexOf("State Board of Education Member", start + heading.length);
    if (nextHeading < 0) throw new Error(`CO_PRIMARY_2024_${districtCode}_BOUNDARY_MISSING`);
    const descriptors = candidates2024[districtCode], pattern = new RegExp(`^(.+?)\\s+((?:[\\d,]+\\s+){${descriptors.length}}[\\d,]+)$`), parsed = [];
    for (const rawLine of text.slice(start + heading.length, nextHeading).split("\n")) {
      const match = rawLine.trim().match(pattern); if (!match || match[1].includes("Election Results")) continue;
      const values = match[2].trim().split(/\s+/).map(integer); parsed.push({ county: match[1].trim(), votes: values.slice(0, -1), sourceTotalVotes: values.at(-1) });
    }
    const total = parsed.pop(); if (!total || total.county !== "Total" || parsed.length !== countyCounts[districtCode]) throw new Error(`CO_PRIMARY_2024_${districtCode}_TABLE_SHAPE_INVALID`);
    tables.push({ districtCode, candidates: descriptors.map(([sourceCandidateName, candidacyKind], index) => ({ sourceCandidateName, candidacyKind, votes: total.votes[index] })), countyRows: parsed, sourceTotalVotes: total.sourceTotalVotes });
  }
  return validateTables(tables, 2024);
}

const row = (county, votes, sourceTotalVotes) => ({ county, votes, sourceTotalVotes });
const table = (districtCode, candidateDescriptors, rows, totals, sourceTotalVotes) => ({ districtCode, candidates: candidateDescriptors.map(([sourceCandidateName, candidacyKind], index) => ({ sourceCandidateName, candidacyKind, votes: totals[index] })), countyRows: rows, sourceTotalVotes });
const candidate = (name) => [name, "named_candidate"];
const writeIn = (name) => [name, "named_write_in"];
const tables2026 = validateTables([
  table("01", [candidate("Melat Kiros"), candidate("Diana DeGette"), candidate("Wanda James")], [row("Arapahoe", [667,565,93],1325),row("Denver",[83188,62150,10982],156320),row("Jefferson",[0,0,0],0)], [83855,62715,11075],157645),
  table("02", [candidate("Joe Neguse")], [row("Boulder",[75179],75179),row("Broomfield",[0],0),row("Clear Creek",[1555],1555),row("Eagle",[4920],4920),row("Gilpin",[1036],1036),row("Grand",[2118],2118),row("Jackson",[30],30),row("Jefferson",[340],340),row("Larimer",[38921],38921),row("Routt",[3901],3901),row("Summit",[4463],4463),row("Weld",[3683],3683)], [136146],136146),
  table("03", [candidate("Alex Kelloff"), candidate("Dwayne L. Romero")], [row("Alamosa",[815,837],1652),row("Archuleta",[845,850],1695),row("Conejos",[381,708],1089),row("Costilla",[253,637],890),row("Delta",[1632,1411],3043),row("Dolores",[75,59],134),row("Eagle",[548,987],1535),row("Garfield",[2710,3567],6277),row("Gunnison",[1500,1361],2861),row("Hinsdale",[31,52],83),row("Huerfano",[486,669],1155),row("La Plata",[4422,5357],9779),row("Las Animas",[797,1202],1999),row("Mesa",[8394,7361],15755),row("Mineral",[89,85],174),row("Moffat",[196,258],454),row("Montezuma",[1385,1291],2676),row("Montrose",[1977,2134],4111),row("Otero",[530,989],1519),row("Ouray",[640,533],1173),row("Pitkin",[1269,2516],3785),row("Pueblo",[8458,13279],21737),row("Rio Blanco",[77,60],137),row("Rio Grande",[549,606],1155),row("Saguache",[524,397],921),row("San Juan",[72,53],125),row("San Miguel",[739,589],1328)], [39394,47848],87242),
  table("04", [candidate("Eileen Laubacher"), writeIn("Jenna Preston")], [row("Adams",[781,8],789),row("Arapahoe",[3812,44],3856),row("Baca",[107,0],107),row("Bent",[268,0],268),row("Cheyenne",[35,0],35),row("Crowley",[190,2],192),row("Douglas",[42986,302],43288),row("El Paso",[424,1],425),row("Elbert",[2022,15],2037),row("Kiowa",[36,0],36),row("Kit Carson",[206,0],206),row("Larimer",[13637,140],13777),row("Lincoln",[173,3],176),row("Logan",[911,1],912),row("Morgan",[1221,11],1232),row("Phillips",[142,0],142),row("Prowers",[466,1],467),row("Sedgwick",[101,0],101),row("Washington",[135,1],136),row("Weld",[4573,36],4609),row("Yuma",[257,1],258)], [72483,566],73049),
  table("05", [candidate("Jessica Killin"), candidate("Joe Reagan")], [row("El Paso",[45511,28864],74375)], [45511,28864],74375),
  table("06", [candidate("Jason Crow")], [row("Adams",[4201],4201),row("Arapahoe",[79253],79253),row("Denver",[287],287),row("Douglas",[1043],1043),row("Jefferson",[9423],9423)], [94207],94207),
  table("07", [candidate("Brittany Pettersen")], [row("Adams",[457],457),row("Broomfield",[13828],13828),row("Chaffee",[3995],3995),row("Custer",[569],569),row("El Paso",[97],97),row("Fremont",[3576],3576),row("Jefferson",[85902],85902),row("Lake",[917],917),row("Park",[2011],2011),row("Teller",[2355],2355),row("Weld",[0],0)], [113707],113707),
  table("08", [candidate("Manny Rutinel"), candidate("Evan Munsing"), candidate("Shannon Bird")], [row("Adams",[35640,2579,17969],56188),row("Larimer",[1698,110,1162],2970),row("Weld",[13097,1028,6991],21116)], [50435,3717,26122],80274),
], 2026);

const captured = new Map();
for (const source of sources) { const bytes = await readFile(resolve(sourceDirectory, source.input)); verify(source.input, bytes, source); await writeExact(resolve(source.output), bytes); captured.set(source.input, bytes); }
const temporary = await mkdtemp(resolve(tmpdir(), "dsa-seats-co-primary-"));
try {
  const pdfPath = resolve(temporary, "2024.pdf"), textPath = resolve(temporary, "2024.txt"); await writeFile(pdfPath, captured.get("2024-biennial-abstract.pdf")); execFileSync("pdftotext", ["-layout", pdfPath, textPath]);
  const tables2024 = parse2024(await readFile(textPath, "utf8"));
  const derived = [
    { output: "data/source/elections/primary-results/colorado/2024/democratic-us-house-normalized.json", bytes: Buffer.from(`${JSON.stringify(tables2024, null, 2)}\n`) },
    { output: "data/source/elections/primary-results/colorado/2026/democratic-us-house-normalized.json", bytes: Buffer.from(`${JSON.stringify(tables2026, null, 2)}\n`) },
  ];
  for (const item of derived) { await writeExact(resolve(item.output), item.bytes); process.stdout.write(`${JSON.stringify({ output: item.output, byteSize: item.bytes.length, sha256: sha(item.bytes), kind: "visually_verified_normalized_transcription" })}\n`); }
} finally { await rm(temporary, { recursive: true, force: true }); }
process.stdout.write(`${JSON.stringify({ importedSources: sources.length, lifecycle: "retained_reviewer_only_not_published", sourceCutoff: "2026-08-06" })}\n`);
