import { assertReleaseDrillEnvironment, runSyntheticReleaseDrill } from "@/operations/release-drill";

async function main(): Promise<void> {
  const connections = assertReleaseDrillEnvironment(process.env);
  const result = await runSyntheticReleaseDrill(connections);
  console.log(JSON.stringify(result));
}
if (process.argv[1]?.endsWith("release-drill.ts")) void main().catch(() => { console.error("Synthetic release drill failed"); process.exitCode = 1; });
