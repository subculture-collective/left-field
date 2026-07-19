import { execFile as execFileCallback } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const root = process.cwd();
const normalizer = join(root, "scripts/normalize-tiger-artifacts.mjs");
const buildScript = join(root, "scripts/build-tiger-artifacts.sh");
const names = ["tiger2025-ak-cd119-selected.geojson", "tiger2025-al-cd119-selected.geojson", "tiger2025-az-cd119-selected.geojson", "tiger2025-fl-cd119-selected.geojson", "tiger2025-selected-states.geojson"];
const sources = ["tl_2025_02_cd119.zip", "tl_2025_01_cd119.zip", "tl_2025_04_cd119.zip", "tl_2025_12_cd119.zip", "tl_2025_us_state.zip"];

async function buildFixture() {
  const workspace = await mkdtemp(join(tmpdir(), "tiger-build-"));
  const scripts = join(workspace, "scripts");
  const geometry = join(workspace, "data/geometry");
  const source = join(workspace, "data/source/tiger2025");
  const mapshaper = join(workspace, "node_modules/.bin/mapshaper");
  await Promise.all([mkdir(scripts, { recursive: true }), mkdir(geometry, { recursive: true }), mkdir(source, { recursive: true }), mkdir(join(workspace, "node_modules/.bin"), { recursive: true })]);
  await cp(buildScript, join(scripts, "build-tiger-artifacts.sh"));
  await writeFile(join(scripts, "normalize-tiger-artifacts.mjs"), `import { cp, mkdir } from "node:fs/promises";
const [input, output] = process.argv.slice(2);
await mkdir(output, { recursive: true });
for (const name of ${JSON.stringify(names)}) await cp(\`${"${input}"}/\${name}\`, \`${"${output}"}/\${name}\`);
`);
  await writeFile(mapshaper, `#!/usr/bin/env bash
set -Eeuo pipefail
output="${"${!#}"}"
printf 'new:%s\\n' "$(basename "$output")" > "$output"
`);
  await chmod(mapshaper, 0o755);
  await Promise.all([...names.map((name) => writeFile(join(geometry, name), `old:${name}\n`)), ...sources.map((name) => writeFile(join(source, name), "source"))]);
  return { geometry, workspace };
}

async function artifactContents(geometry: string) {
  return Promise.all(names.map((name) => readFile(join(geometry, name), "utf8")));
}

function feature(sourceGeoid: string) {
  return { type: "Feature", properties: { GEOID: sourceGeoid, STATEFP: "02", CD119FP: "00", STUSPS: "AK", NAMELSAD: "At-Large" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] } };
}

describe("TIGER artifact tooling", () => {
  it("normalizes identically on consecutive runs", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "tiger-normalize-"));
    const input = join(workspace, "input");
    const once = join(workspace, "once");
    const twice = join(workspace, "twice");
    try {
      await mkdir(input);
      await Promise.all(names.map(async (name) => writeFile(join(input, name), JSON.stringify({ type: "FeatureCollection", features: [feature("z"), feature("a")] }))));
      await execFile(process.execPath, [normalizer, input, once]);
      await execFile(process.execPath, [normalizer, once, twice]);
      await Promise.all(names.map(async (name) => expect(await readFile(join(twice, name))).toEqual(await readFile(join(once, name)))));
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("keeps build safeguards and the raw Alaska at-large filter", async () => {
    const script = await readFile(buildScript, "utf8");
    expect(script).toContain("set -Eeuo pipefail");
    expect(script).toMatch(/mktemp -d/);
    expect(script).toMatch(/trap cleanup EXIT/);
    expect(script).toContain('"$root/node_modules/.bin/mapshaper"');
    expect(script).not.toContain("npm exec");
    expect(script).toContain(".tiger-backup.");
    expect(script).toContain('[[ -e "$backup/$name" ]] && mv "$backup/$name" "$geometry/$name"');
    expect(script).toContain("STATEFP == \"02\" && CD119FP == \"00\"");
    expect(script).not.toContain("STATEFP == \"02\" && CD119FP == \"AL\"");
  });

  it("publishes all replacement artifacts and removes its backup", async () => {
    const { geometry, workspace } = await buildFixture();
    try {
      await execFile("bash", [join(workspace, "scripts/build-tiger-artifacts.sh")], { cwd: workspace });
      expect(await artifactContents(geometry)).toEqual(names.map((name) => `new:${name}\n`));
      expect((await readdir(geometry)).filter((name) => name.startsWith(".tiger-backup.")).length).toBe(0);
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("restores every original artifact when publication fails after backup", async () => {
    const { geometry, workspace } = await buildFixture();
    const fakeBin = join(workspace, "fake-bin");
    try {
      await mkdir(fakeBin);
      const mv = join(fakeBin, "mv");
      await writeFile(mv, `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1" == */normalized/* && "$2" == */data/geometry/* ]]; then
  exit 47
fi
exec /bin/mv "$@"
`);
      await chmod(mv, 0o755);
      await expect(execFile("bash", [join(workspace, "scripts/build-tiger-artifacts.sh")], { cwd: workspace, env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` } })).rejects.toMatchObject({ code: 47 });
      expect(await artifactContents(geometry)).toEqual(names.map((name) => `old:${name}\n`));
      expect((await readdir(geometry)).filter((name) => name.startsWith(".tiger-backup.")).length).toBe(0);
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });
});
