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

export interface CanonicalMemoryStore {
  upsert(record: MemoryRecord): MemoryRecord;
  seed(records: readonly MemoryRecord[]): void;
  list(): MemoryRecord[];
  search(input: string, options?: SearchMemoryOptions): RetrievalResult;
  promote(recordId: string, status: LifecycleStatus): MemoryRecord | null;
}

export class InMemoryCanonicalMemoryStore implements CanonicalMemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  constructor(records: readonly MemoryRecord[] = []) {
    this.seed(records);
  }

  upsert(record: MemoryRecord): MemoryRecord {
    const validatedRecord = decodeMemoryRecord(record);
    this.records.set(validatedRecord.id, validatedRecord);
    return validatedRecord;
  }

  seed(records: readonly MemoryRecord[]): void {
    records.forEach((record) => this.upsert(record));
  }

  list(): MemoryRecord[] {
    return [...this.records.values()];
  }

  search(input: string, options?: SearchMemoryOptions): RetrievalResult {
    return searchMemoryRecords(this.list(), input, options);
  }

  promote(recordId: string, status: LifecycleStatus): MemoryRecord | null {
    const record = this.records.get(recordId);
    if (!record) return null;

    const promotedRecord = decodeMemoryRecord({
      ...record,
      status: decodeLifecycleStatus(status),
      updatedAt: new Date().toISOString()
    });
    this.records.set(recordId, promotedRecord);
    return promotedRecord;
  }
}

function decodeMemoryRecord(record: MemoryRecord): MemoryRecord {
  const result = Schema.decodeUnknownEither(MemoryRecordSchema)(record);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}

function decodeLifecycleStatus(status: LifecycleStatus): LifecycleStatus {
  const result = Schema.decodeUnknownEither(LifecycleStatusSchema)(status);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}
