import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const base = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData";
const tables = ["b01003", "b19013", "b01002"];
const targetGeoIds = new Set([
  "5001900US0200",
  "5001900US0102",
  "5001900US0105",
  "5001900US0107",
  "5001900US0401",
  "5001900US0406",
  "5001900US0407",
  "5001900US1206",
  "5001900US1212",
  "5001900US1226",
]);

const output = { release: "2024 ACS 5-year", tables: [] };

for (const table of tables) {
  const url = `${base}/acsdt5y2024-${table}.dat`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const [header, ...lines] = bytes.toString("utf8").trim().split("\n");
  const columns = header.trim().split("|");
  const rows = lines
    .map((line) => line.trim().split("|"))
    .filter(([geoId]) => targetGeoIds.has(geoId))
    .map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])))
    .sort((left, right) => left.GEO_ID < right.GEO_ID ? -1 : left.GEO_ID > right.GEO_ID ? 1 : 0);
  if (rows.length !== targetGeoIds.size) {
    throw new Error(`${table}: expected ${targetGeoIds.size} districts, received ${rows.length}`);
  }
  output.tables.push({ table: table.toUpperCase(), url, checksumSha256, rows });
}

await mkdir("data/source/acs2024", { recursive: true });
await writeFile(
  "data/source/acs2024/selected-district-observations.json",
  `${JSON.stringify(output, null, 2)}\n`,
);
