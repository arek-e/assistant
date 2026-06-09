import { Schema } from "effect";
import {
  searchMemoryRecords,
  type RetrievalResult,
  type SearchMemoryOptions
} from "./retrieval";
import {
  LifecycleStatusSchema,
  MemoryRecordSchema,
  type LifecycleStatus,
  type MemoryRecord
} from "./types";

interface MemoryRecordRow extends Record<string, SqlStorageValue> {
  record: string;
}

export class SqliteCanonicalMemoryStore {
  constructor(private readonly sql: SqlStorage) {
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
    return recordToSave;
  }

  seed(records: readonly MemoryRecord[]): void {
    records.forEach((record) => this.upsert(record));
  }

  list(): MemoryRecord[] {
    return this.sql
      .exec<MemoryRecordRow>(
        "SELECT record FROM assistant_memory_records ORDER BY updated_at DESC"
      )
      .toArray()
      .map((row) => decodeMemoryRecord(parseJson(row.record)));
  }

  search(input: string, options?: SearchMemoryOptions): RetrievalResult {
    return searchMemoryRecords(this.list(), input, options);
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
      .exec<MemoryRecordRow>(
        "SELECT record FROM assistant_memory_records WHERE id = ?",
        recordId
      )
      .toArray();
    return rows[0] ? decodeMemoryRecord(parseJson(rows[0].record)) : null;
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
  }
}

function decodeMemoryRecord(record: unknown): MemoryRecord {
  const result = Schema.decodeUnknownEither(MemoryRecordSchema)(record);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}

function decodeLifecycleStatus(status: unknown): LifecycleStatus {
  const result = Schema.decodeUnknownEither(LifecycleStatusSchema)(status);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}
