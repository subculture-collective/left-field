import { randomBytes } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { chmod, mkdir, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type FecV2LineageRow = Readonly<{ fileNumber: number; pageSha256: string; pass: 1 | 2; occurrenceIndex: number }>;
export type FecV2LineageSpoolOptions = Readonly<{ tempRoot?: string; maxRows?: number; maxBytes?: number; maxLineBytes?: number }>;
const DEFAULT_ROWS = 4_000_000, DEFAULT_BYTES = 768 * 1024 * 1024, DEFAULT_LINE = 256;
const valid = (row: FecV2LineageRow): boolean => Number.isSafeInteger(row.fileNumber) && row.fileNumber > 0 && /^[a-f0-9]{64}$/.test(row.pageSha256) && (row.pass === 1 || row.pass === 2) && Number.isSafeInteger(row.occurrenceIndex) && row.occurrenceIndex >= 1 && row.occurrenceIndex <= 100;

/** A private, metadata-only, bounded bridge between enumeration and ledger staging. */
export class FecV2LineageSpool {
  private constructor(private readonly dir: string, private readonly path: string, private readonly handle: Awaited<ReturnType<typeof open>>, private readonly limits: Required<Pick<FecV2LineageSpoolOptions, "maxRows" | "maxBytes" | "maxLineBytes">>) {}
  private rows = 0;
  private bytes = 0;
  private closed = false;

  static async create(options: FecV2LineageSpoolOptions = {}): Promise<FecV2LineageSpool> {
    const limits = { maxRows: options.maxRows ?? DEFAULT_ROWS, maxBytes: options.maxBytes ?? DEFAULT_BYTES, maxLineBytes: options.maxLineBytes ?? DEFAULT_LINE };
    if (!Object.values(limits).every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("FEC_V2_LINEAGE_SPOOL_INVALID");
    const root = options.tempRoot ?? tmpdir();
    await mkdir(root, { recursive: true, mode: 0o700 });
    const dir = join(root, `fec-v2-lineage-${randomBytes(16).toString("hex")}`);
    await mkdir(dir, { mode: 0o700 }); await chmod(dir, 0o700);
    const path = join(dir, "lineage.jsonl");
    try {
      const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      await chmod(path, 0o600);
      return new FecV2LineageSpool(dir, path, handle, limits);
    } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
  }

  async append(row: FecV2LineageRow): Promise<void> {
    if (this.closed || !valid(row)) throw new Error("FEC_V2_LINEAGE_SPOOL_INVALID");
    const line = `${JSON.stringify({ fileNumber: row.fileNumber, pageSha256: row.pageSha256, pass: row.pass, occurrenceIndex: row.occurrenceIndex })}\n`;
    const size = Buffer.byteLength(line);
    if (size > this.limits.maxLineBytes || this.rows >= this.limits.maxRows || this.bytes + size > this.limits.maxBytes) throw new Error("FEC_V2_LINEAGE_SPOOL_LIMIT");
    await this.handle.write(line); // awaited writes provide sink backpressure
    this.rows++; this.bytes += size;
  }

  async close(): Promise<void> { if (!this.closed) { this.closed = true; await this.handle.sync(); await this.handle.close(); } }
  async *read(): AsyncGenerator<FecV2LineageRow> {
    await this.close();
    const reader = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const lines = createInterface({ input: createReadStream(this.path, { fd: reader.fd, autoClose: false }), crlfDelay: Infinity });
      for await (const line of lines) {
        if (Buffer.byteLength(line) > this.limits.maxLineBytes) throw new Error("FEC_V2_LINEAGE_SPOOL_INVALID");
        let row: unknown; try { row = JSON.parse(line); } catch { throw new Error("FEC_V2_LINEAGE_SPOOL_INVALID"); }
        if (!row || typeof row !== "object" || Object.keys(row).length !== 4) throw new Error("FEC_V2_LINEAGE_SPOOL_INVALID");
        const value = row as FecV2LineageRow;
        if (!valid(value)) throw new Error("FEC_V2_LINEAGE_SPOOL_INVALID");
        yield value;
      }
    } finally { await reader.close(); }
  }
  async cleanup(): Promise<void> { try { await this.close(); } finally { await rm(this.dir, { recursive: true, force: true }); } }
  /** Test-only visibility; the directory is intentionally private. */
  get testingPath(): string { return this.path; }
}
