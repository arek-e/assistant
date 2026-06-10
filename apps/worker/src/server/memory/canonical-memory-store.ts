import {
  searchMemoryRecords,
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

  debugSnapshot(limit = 50): MemoryDebugSnapshot {
    return createMemoryDebugSnapshot(this.list(), limit);
  }
}
