import {
  isBlockedLifecycle,
  memorySearchTokens,
  scoreMemoryRecord,
  type RetrievalHit,
  type RetrievalResult,
  type SearchMemoryOptions
} from "./retrieval";
import {
  decodeLifecycleStatus,
  decodeMemoryRecord,
  type LifecycleStatus,
  type MemoryRecord
} from "./types";
import type { CanonicalMemoryStore, MemoryDebugSnapshot } from "./contract";
import { createMemoryDebugSnapshot } from "./debug-snapshot";

export type MemorySqlValue = string | number | bigint | ArrayBuffer | null;

export interface MemorySqlCursor {
  toArray(): Record<string, MemorySqlValue>[];
}

export interface MemorySqlStorage {
  exec(query: string, ...params: MemorySqlValue[]): MemorySqlCursor;
}

interface MemoryRecordRow extends Record<string, MemorySqlValue> {
  record: string;
}

interface MemorySearchRow extends MemoryRecordRow {
  rank: number;
}

interface RankedCandidate {
  hit: RetrievalHit;
}

export class SqliteCanonicalMemoryStore implements CanonicalMemoryStore {
  constructor(private readonly sql: MemorySqlStorage) {
    this.ensureSchema();
  }

  upsert(record: MemoryRecord): MemoryRecord {
    const validatedRecord = decodeMemoryRecord(record);
    const existingRecord = this.get(validatedRecord.id);
    const recordToSave = existingRecord
      ? { ...validatedRecord, createdAt: existingRecord.createdAt }
      : validatedRecord;

    this.sql.exec(
      `
        INSERT INTO assistant_memory_records (
          id,
          kind,
          scope,
          status,
          title,
          body,
          evidence,
          rationale,
          created_at,
          updated_at,
          re_eval_trigger,
          consumer_rules,
          tags,
          supersedes,
          record
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          scope = excluded.scope,
          status = excluded.status,
          title = excluded.title,
          body = excluded.body,
          evidence = excluded.evidence,
          rationale = excluded.rationale,
          updated_at = excluded.updated_at,
          re_eval_trigger = excluded.re_eval_trigger,
          consumer_rules = excluded.consumer_rules,
          tags = excluded.tags,
          supersedes = excluded.supersedes,
          record = excluded.record
      `,
      recordToSave.id,
      recordToSave.kind,
      recordToSave.scope,
      recordToSave.status,
      recordToSave.title,
      recordToSave.body,
      recordToSave.evidence,
      recordToSave.rationale,
      recordToSave.createdAt,
      recordToSave.updatedAt,
      recordToSave.reEvalTrigger,
      JSON.stringify(recordToSave.consumerRules),
      JSON.stringify(recordToSave.tags),
      JSON.stringify(recordToSave.supersedes),
      JSON.stringify(recordToSave)
    );
    this.upsertFtsRecord(recordToSave);
    return recordToSave;
  }

  seed(records: readonly MemoryRecord[]): void {
    records.forEach((record) => this.upsert(record));
  }

  list(): MemoryRecord[] {
    return this.decodeRows(this.listRows());
  }

  private listRows(): MemoryRecordRow[] {
    return this.sql
      .exec(
        "SELECT record FROM assistant_memory_records ORDER BY updated_at DESC"
      )
      .toArray() as MemoryRecordRow[];
  }

  private decodeRows(rows: MemoryRecordRow[]): MemoryRecord[] {
    return rows.map((row) => decodeMemoryRecord(parseJson(row.record)));
  }

  search(input: string, options?: SearchMemoryOptions): RetrievalResult {
    const limit = options?.limit ?? 5;
    const tokens = memorySearchTokens(input);
    const candidates = combineCandidates([
      ...this.searchSqlCandidates(input, tokens, limit * 3),
      ...this.searchFtsCandidates(input, tokens, limit * 3)
    ]);
    const sortedCandidates = candidates.sort(compareCandidates);
    const hits = sortedCandidates
      .filter(
        ({ hit }) => options?.includeBlocked || !isBlockedLifecycle(hit.record)
      )
      .map(({ hit }) => hit)
      .slice(0, limit);
    const lifecycleViolations = hits
      .filter((hit) => isBlockedLifecycle(hit.record))
      .map((hit) => hit.record.id);
    const blockedRecordIds = [
      ...new Set(
        sortedCandidates
          .filter(({ hit }) => isBlockedLifecycle(hit.record))
          .map(({ hit }) => hit.record.id)
      )
    ];

    return { hits, lifecycleViolations, blockedRecordIds };
  }

  promote(recordId: string, status: LifecycleStatus): MemoryRecord | null {
    const record = this.get(recordId);
    if (!record) return null;

    const promotedRecord = decodeMemoryRecord({
      ...record,
      status: decodeLifecycleStatus(status),
      updatedAt: new Date().toISOString()
    });
    this.upsert(promotedRecord);
    return promotedRecord;
  }

  private get(recordId: string): MemoryRecord | null {
    const rows = this.sql
      .exec(
        "SELECT record FROM assistant_memory_records WHERE id = ?",
        recordId
      )
      .toArray() as MemoryRecordRow[];
    return rows[0] ? decodeMemoryRecord(parseJson(rows[0].record)) : null;
  }

  debugSnapshot(limit = 50): MemoryDebugSnapshot {
    return createMemoryDebugSnapshot(this.list(), limit);
  }

  private ensureSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS assistant_memory_records (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        evidence TEXT NOT NULL,
        rationale TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        re_eval_trigger TEXT NOT NULL,
        consumer_rules TEXT NOT NULL,
        tags TEXT NOT NULL,
        supersedes TEXT NOT NULL,
        record TEXT NOT NULL
      )
    `);
    this.sql.exec(
      "CREATE INDEX IF NOT EXISTS assistant_memory_status_idx ON assistant_memory_records(status)"
    );
    this.sql.exec(
      "CREATE INDEX IF NOT EXISTS assistant_memory_kind_idx ON assistant_memory_records(kind)"
    );
    this.sql.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS assistant_memory_records_fts
      USING fts5(
        record_id UNINDEXED,
        title,
        body,
        evidence,
        rationale,
        tags
      )
    `);
    this.rebuildFtsIndex();
  }

  private rebuildFtsIndex(): void {
    this.sql.exec("DELETE FROM assistant_memory_records_fts");
    this.sql.exec(`
      INSERT INTO assistant_memory_records_fts (
        record_id,
        title,
        body,
        evidence,
        rationale,
        tags
      )
      SELECT
        id,
        title,
        body,
        evidence,
        rationale,
        tags
      FROM assistant_memory_records
    `);
  }

  private upsertFtsRecord(record: MemoryRecord): void {
    this.sql.exec(
      "DELETE FROM assistant_memory_records_fts WHERE record_id = ?",
      record.id
    );
    this.sql.exec(
      `
        INSERT INTO assistant_memory_records_fts (
          record_id,
          title,
          body,
          evidence,
          rationale,
          tags
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      record.id,
      record.title,
      record.body,
      record.evidence,
      record.rationale,
      JSON.stringify(record.tags)
    );
  }

  private searchSqlCandidates(
    input: string,
    tokens: string[],
    limit: number
  ): RankedCandidate[] {
    const normalizedInput = input.trim().toLowerCase();
    const exactRows = this.sql
      .exec(
        `
          SELECT record
          FROM assistant_memory_records
          WHERE lower(id) = ?
            OR lower(title) = ?
          LIMIT ?
        `,
        normalizedInput,
        normalizedInput,
        limit
      )
      .toArray() as MemoryRecordRow[];
    const candidates = exactRows.map((row) =>
      this.toCandidate(row, tokens, 8, "sql:exact")
    );

    tokens.forEach((token) => {
      const pattern = `%${token}%`;
      const tokenRows = this.sql
        .exec(
          `
            SELECT record
            FROM assistant_memory_records
            WHERE lower(id) LIKE ?
              OR lower(kind) LIKE ?
              OR lower(scope) LIKE ?
              OR lower(title) LIKE ?
              OR lower(body) LIKE ?
              OR lower(evidence) LIKE ?
              OR lower(rationale) LIKE ?
              OR lower(re_eval_trigger) LIKE ?
              OR lower(tags) LIKE ?
              OR lower(supersedes) LIKE ?
            LIMIT ?
          `,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          limit
        )
        .toArray() as MemoryRecordRow[];
      tokenRows.forEach((row) =>
        candidates.push(this.toCandidate(row, tokens, 2, `sql:${token}`))
      );
    });

    return candidates;
  }

  private searchFtsCandidates(
    input: string,
    tokens: string[],
    limit: number
  ): RankedCandidate[] {
    const ftsQuery = toFtsQuery(input);
    if (!ftsQuery) return [];

    const rows = this.sql
      .exec(
        `
          SELECT
            memory.record,
            bm25(assistant_memory_records_fts) AS rank
          FROM assistant_memory_records_fts
          JOIN assistant_memory_records AS memory
            ON memory.id = assistant_memory_records_fts.record_id
          WHERE assistant_memory_records_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `,
        ftsQuery,
        limit
      )
      .toArray() as MemorySearchRow[];

    return rows.map((row) =>
      this.toCandidate(
        row,
        tokens,
        4,
        `fts:${ftsQuery}${row.rank == null ? "" : `:${row.rank}`}`
      )
    );
  }

  private toCandidate(
    row: MemoryRecordRow,
    tokens: string[],
    scoreBoost: number,
    reason: string
  ): RankedCandidate {
    const record = decodeMemoryRecord(parseJson(row.record));
    const hit = scoreMemoryRecord(record, tokens);

    return {
      hit: {
        ...hit,
        score: hit.score + scoreBoost,
        reasons: [reason, ...hit.reasons]
      }
    };
  }
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate) {
  if (right.hit.score !== left.hit.score)
    return right.hit.score - left.hit.score;
  return left.hit.record.id.localeCompare(right.hit.record.id);
}

function combineCandidates(candidates: RankedCandidate[]): RankedCandidate[] {
  const byId = new Map<string, RankedCandidate>();

  candidates.forEach((candidate) => {
    const existing = byId.get(candidate.hit.record.id);
    if (!existing) {
      byId.set(candidate.hit.record.id, candidate);
      return;
    }

    existing.hit.score += candidate.hit.score;
    existing.hit.reasons = [
      ...new Set([...existing.hit.reasons, ...candidate.hit.reasons])
    ];
  });

  return [...byId.values()];
}

function toFtsQuery(input: string): string | null {
  const tokens = memorySearchTokens(input)
    .map((token) => token.replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter((token) => token.length > 1);

  return tokens.length > 0
    ? [...new Set(tokens)].map((token) => `${token}*`).join(" OR ")
    : null;
}
