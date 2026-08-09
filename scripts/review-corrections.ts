import { Pool, type PoolConfig } from "pg";
import { CorrectionReviewerRepository, type CorrectionListItem, type TransitionCorrectionInput, type TransitionCorrectionResult } from "@/corrections/repository";
import packageJson from "../package.json";

export type CorrectionReviewArguments =
  | { readonly operation: "list"; readonly limit: number; readonly after?: { readonly submittedAt: Date; readonly id: string }; readonly includeContent: boolean }
  | ({ readonly operation: "transition" } & TransitionCorrectionInput);

type ReviewerRepository = Pick<CorrectionReviewerRepository, "list" | "transition">;

const HELP = `Usage:
  npm run corrections:review -- list [options]
  npm run corrections:review -- transition [options]
  npm run corrections:review -- completion <bash|zsh|fish>

Commands:
  list        List correction metadata without submitted content by default
  transition  Append an optimistic correction-review state transition
  completion  Print a shell completion script for a corrections-review wrapper

Global options:
  --help      Show this help
  --version   Show the CLI version

List options:
  --limit <1-100>
  --after-time <canonical ISO-8601> --after-id <uuid>
  --include-content  Interactive TTY only

Transition options:
  --id <uuid> --expected-sequence <integer> --expected-status <status>
  --to-status <status> --reason <reason-code>
  [--candidate-release <release-id>] [--approved-snapshot <snapshot-id>]
`;

const COMPLETION_WORDS = "list transition completion --help --version --limit --after-time --after-id --include-content --id --expected-sequence --expected-status --to-status --reason --candidate-release --approved-snapshot";

function renderCompletion(shell: string): string {
  if (shell === "bash") return `_dsa_seats_corrections_review() { COMPREPLY=( $(compgen -W '${COMPLETION_WORDS}' -- "\${COMP_WORDS[COMP_CWORD]}") ); }\ncomplete -F _dsa_seats_corrections_review corrections-review\n`;
  if (shell === "zsh") return `#compdef corrections-review\n_arguments '1:command:(list transition completion)' '*:option:(${COMPLETION_WORDS})'\n`;
  if (shell === "fish") return `complete -c corrections-review -f -a 'list transition completion'\ncomplete -c corrections-review -l help -d 'Show help'\ncomplete -c corrections-review -l version -d 'Show version'\n`;
  throw new Error("Completion shell must be bash, zsh, or fish");
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCorrectionReviewArguments(argv: readonly string[]): CorrectionReviewArguments {
  if (argv[0] === "transition") return parseTransitionArguments(argv.slice(1));
  if (argv[0] !== "list") throw new Error("Require list or transition operation");
  let limit = 50;
  let includeContent = false;
  let afterSubmittedAt: Date | undefined;
  let afterId: string | undefined;
  const seen = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag || seen.has(flag)) throw new Error("Invalid or duplicate correction review argument");
    seen.add(flag);
    if (flag === "--include-content") { includeContent = true; continue; }
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error("Correction review argument requires a value");
    if (flag === "--limit" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100) limit = Number(value);
    else if (flag === "--after-time" && !afterSubmittedAt) {
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error("--after-time must be canonical ISO-8601");
      afterSubmittedAt = parsed;
    } else if (flag === "--after-id" && !afterId && uuid.test(value)) afterId = value;
    else throw new Error("Invalid or duplicate correction review argument");
  }
  if (Boolean(afterSubmittedAt) !== Boolean(afterId)) throw new Error("Cursor time and id must be supplied together");
  return { operation: "list", limit, includeContent, ...(afterSubmittedAt && afterId ? { after: { submittedAt: afterSubmittedAt, id: afterId } } : {}) };
}

function parseTransitionArguments(argv: readonly string[]): Extract<CorrectionReviewArguments, { operation: "transition" }> {
  const values = new Map<string, string>();
  const allowed = new Set(["--id", "--expected-sequence", "--expected-status", "--to-status", "--reason", "--candidate-release", "--approved-snapshot"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !allowed.has(flag) || values.has(flag) || !value || value.startsWith("--")) throw new Error("Invalid or duplicate correction transition argument");
    values.set(flag, value);
  }
  const correctionId = values.get("--id");
  const sequence = values.get("--expected-sequence");
  const expectedStatus = values.get("--expected-status");
  const toStatus = values.get("--to-status");
  const reasonCode = values.get("--reason");
  const candidateReleaseId = values.get("--candidate-release");
  const approvedSnapshotId = values.get("--approved-snapshot");
  if (!correctionId || !uuid.test(correctionId) || !sequence || !/^\d+$/.test(sequence) || !Number.isSafeInteger(Number(sequence)) || Number(sequence) < 1 || !expectedStatus || !toStatus || !reasonCode) throw new Error("Complete optimistic transition fields are required");
  const transition = `${expectedStatus}:${toStatus}:${reasonCode}`;
  const ordinary = new Set([
    "submitted:in_review:triaged", "submitted:rejected:not_actionable", "submitted:rejected:withdrawn",
    "in_review:accepted:approved", "in_review:rejected:not_actionable", "in_review:rejected:withdrawn",
    "accepted:rejected:not_actionable", "accepted:rejected:withdrawn",
  ]);
  if (ordinary.has(transition)) {
    if (candidateReleaseId || approvedSnapshotId) throw new Error("This transition cannot bind candidate evidence");
  } else if (transition === "accepted:queued:needs_candidate") {
    if (!candidateReleaseId || approvedSnapshotId) throw new Error("Queued transition requires only a candidate release");
  } else if (transition === "queued:accepted:candidate_ready") {
    if (candidateReleaseId || approvedSnapshotId) throw new Error("Candidate-ready transition does not bind evidence");
  } else if (transition === "queued:incorporated:incorporated") {
    if (!candidateReleaseId || !approvedSnapshotId) throw new Error("Incorporated transition requires candidate release and approved snapshot");
  } else throw new Error("Invalid correction transition");
  if (candidateReleaseId && !/^rel_[A-Za-z0-9_-]{1,128}$/.test(candidateReleaseId)) throw new Error("Invalid candidate release id");
  if (approvedSnapshotId && !/^[A-Za-z0-9_-]{1,128}$/.test(approvedSnapshotId)) throw new Error("Invalid approved snapshot id");
  return {
    operation: "transition",
    correctionId,
    expectedSequence: Number(sequence),
    expectedStatus,
    toStatus,
    reasonCode,
    ...(candidateReleaseId ? { candidateReleaseId } : {}),
    ...(approvedSnapshotId ? { approvedSnapshotId } : {}),
  };
}

function projectListItem(item: CorrectionListItem, includeContent: boolean): Record<string, unknown> {
  return {
    id: item.id,
    releaseId: item.releaseId,
    seatCycleId: item.seatCycleId,
    fieldPath: item.fieldPath,
    submittedAt: item.submittedAt.toISOString(),
    status: item.status,
    sequence: item.sequence,
    ...(includeContent
      ? { explanation: item.explanation, sourceUrl: item.sourceUrl }
      : { explanationPresent: item.explanation.length > 0, sourceUrlPresent: item.sourceUrl !== null }),
  };
}

export async function executeCorrectionReview(
  args: CorrectionReviewArguments,
  repository: ReviewerRepository,
  options: { readonly outputIsTTY: boolean } = { outputIsTTY: process.stdout.isTTY === true },
): Promise<Record<string, unknown>> {
  if (args.operation === "list") {
    if (args.includeContent && !options.outputIsTTY) throw new Error("--include-content requires an interactive TTY");
    const items = await repository.list({ limit: args.limit, after: args.after });
    return { operation: "list", count: items.length, items: items.map(item => projectListItem(item, args.includeContent)) };
  }
  const input: TransitionCorrectionInput = {
    correctionId: args.correctionId,
    expectedSequence: args.expectedSequence,
    expectedStatus: args.expectedStatus,
    toStatus: args.toStatus,
    reasonCode: args.reasonCode,
    ...(args.candidateReleaseId ? { candidateReleaseId: args.candidateReleaseId } : {}),
    ...(args.approvedSnapshotId ? { approvedSnapshotId: args.approvedSnapshotId } : {}),
  };
  const result: TransitionCorrectionResult = await repository.transition(input);
  return { operation: "transition", correctionId: args.correctionId, ...result };
}

export function correctionReviewerPoolConfig(env: Readonly<Record<string, string | undefined>>): PoolConfig {
  const connectionString = env.CORRECTION_REVIEWER_DATABASE_URL;
  if (!connectionString) throw new Error("CORRECTION_REVIEWER_DATABASE_URL is required");
  const url = new URL(connectionString);
  if (!(url.protocol === "postgres:" || url.protocol === "postgresql:") || !url.username) throw new Error("CORRECTION_REVIEWER_DATABASE_URL must be a PostgreSQL URL with a LOGIN username");
  return { connectionString, max: 2, connectionTimeoutMillis: 5_000, statement_timeout: 15_000, lock_timeout: 1_000, query_timeout: 15_000 };
}

export async function runCorrectionReviewCli(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  dependencies: { readonly write: (value: string) => void; readonly createPool: (config: PoolConfig) => Pool } = {
    write: value => process.stdout.write(value),
    createPool: config => new Pool(config),
  },
): Promise<number> {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    dependencies.write(HELP);
    return 0;
  }
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-V")) {
    dependencies.write(`${packageJson.version}\n`);
    return 0;
  }
  if (argv[0] === "completion") {
    if (argv.length !== 2) throw new Error("Completion shell must be bash, zsh, or fish");
    dependencies.write(renderCompletion(argv[1]!));
    return 0;
  }
  const args = parseCorrectionReviewArguments(argv);
  const pool = dependencies.createPool(correctionReviewerPoolConfig(env));
  try {
    const result = await executeCorrectionReview(args, new CorrectionReviewerRepository(pool));
    dependencies.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
  return 0;
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> {
  process.exitCode = await runCorrectionReviewCli(argv, env);
}

if (process.argv[1]?.endsWith("review-corrections.ts")) void main().catch(() => { process.stderr.write("Correction review failed\n"); process.exitCode = 1; });
