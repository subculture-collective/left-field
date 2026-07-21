/**
 * Mandatory, local-only browser gate for the nationwide MVP.  This script
 * owns its disposable fixture; generic Playwright commands deliberately do
 * not acquire or mutate databases.
 */
import { createServer } from "node:net";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

export type Task13Environment = { databaseUrl: string; mapRoot: string; profilePath: string };

export const task13PlaywrightArgs = [
  "playwright", "test", "tests/e2e/nationwide-mvp.spec.ts", "tests/e2e/task10-map.spec.ts", "tests/e2e/task11-corrections.spec.ts", "tests/e2e/task12-lookup.spec.ts",
  "--project=desktop-chromium", "--project=task13-390px", "--workers=1", "--forbid-only", "--reporter=list,./scripts/task13-playwright-reporter.ts",
];

export function task13BrowserEnvironment(env: NodeJS.ProcessEnv, fixture: Task13Environment, port: number): NodeJS.ProcessEnv {
  return {
    ...env,
    DATABASE_URL: fixture.databaseUrl,
    MAP_ARTIFACT_ROOT: fixture.mapRoot,
    E2E_MAP_PROFILE_PATH: fixture.profilePath,
    E2E_PORT: String(port),
    E2E_SERVER_COMMAND: undefined,
    E2E_BASE_URL: undefined,
    E2E_LOOKUP_ENABLED: undefined,
  };
}

export function assertTask13Environment(env: Readonly<Record<string, string | undefined>>): Task13Environment {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the Task13 browser harness");
  let url: URL;
  try { url = new URL(databaseUrl); } catch { throw new Error("DATABASE_URL must be a valid URL"); }
  const database = decodeURIComponent(url.pathname).replace(/^\//, "");
  if (!/_test$/i.test(database)) throw new Error("DATABASE_URL must name a disposable database ending in _test");
  if (env.NODE_ENV?.toLowerCase() === "production" || /(^|[.-])prod(uction)?([.-]|$)/i.test(url.hostname)) throw new Error("Task13 browser harness refuses production");
  if (env.E2E_BASE_URL) throw new Error("E2E_BASE_URL is not allowed: Task13 starts its own local server");
  if (!env.MAP_ARTIFACT_ROOT || !isAbsolute(env.MAP_ARTIFACT_ROOT)) throw new Error("MAP_ARTIFACT_ROOT must be an absolute dedicated Task13 test directory");
  const mapRoot = resolve(env.MAP_ARTIFACT_ROOT);
  const temporary = resolve(tmpdir());
  const fromTemporary = relative(temporary, mapRoot);
  const underTemporary = fromTemporary.length > 0 && fromTemporary !== ".." && !fromTemporary.startsWith(`..${sep}`) && !isAbsolute(fromTemporary);
  const testPath = /(?:^|[\\/])(?:test|tests|tmp|temp)(?:[\\/]|$)/i.test(mapRoot);
  if (!underTemporary && !testPath) throw new Error("MAP_ARTIFACT_ROOT must be under a local temp/test path");
  if (!/task13/i.test(mapRoot) || !/^task10(?:[-_][a-z0-9]+)*$/i.test(basename(mapRoot))) throw new Error("MAP_ARTIFACT_ROOT must be a dedicated Task10 directory inside a Task13 test root");
  const profilePath = env.E2E_MAP_PROFILE_PATH;
  if (!profilePath || !/^\/seats\/[^/?#]+$/.test(profilePath)) throw new Error("E2E_MAP_PROFILE_PATH must name the seeded profile route");
  return { databaseUrl, mapRoot, profilePath };
}

export async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Could not allocate a local browser port"));
      const { port } = address;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { env, stdio: "pipe", encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  if (/\b(?:skipped|pending)\b/i.test(output)) throw new Error("Task13 browser gate does not permit skipped tests");
}

async function main(): Promise<void> {
  const { databaseUrl, mapRoot, profilePath } = assertTask13Environment(process.env);
  const port = await availablePort();
  const env = task13BrowserEnvironment(process.env, { databaseUrl, mapRoot, profilePath }, port);
  run("npm", ["run", "db:migrate"], env);
  run("npx", ["tsx", "scripts/seed-task10-map-e2e.ts"], env);
  run("npx", task13PlaywrightArgs, env);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
