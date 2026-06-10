import {
  searchMemoryRecords,
  type RetrievalResult,
  type SearchMemoryOptions
} from "./retrieval";
import { toMemoryRecordActor, type MemoryAccessContext } from "./access";
import { createMemoryRecord } from "./record";
import {
  decodeLifecycleStatus,
  type LifecycleStatus,
  type MemoryRecord,
  type MemoryRecordDraft
} from "./types";
import type { CanonicalMemoryStore, MemoryDebugSnapshot } from "./contract";
import { createMemoryDebugSnapshot } from "./debug-snapshot";

export class InMemoryCanonicalMemoryStore implements CanonicalMemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  constructor(records: readonly MemoryRecordDraft[] = []) {
    this.seed(records);
  }

  upsert(record: MemoryRecordDraft): MemoryRecord {
    const existingRecord = this.records.get(record.id);
    const validatedRecord = createMemoryRecord(
      existingRecord
        ? { ...record, createdAt: existingRecord.createdAt }
        : record
    );
    this.records.set(validatedRecord.id, validatedRecord);
    return validatedRecord;
  }

  seed(records: readonly MemoryRecordDraft[]): void {
    records.forEach((record) => this.upsert(record));
  }

  list(): MemoryRecord[] {
    return [...this.records.values()];
  }

  search(
    input: string,
    accessContext: MemoryAccessContext,
    options?: SearchMemoryOptions
  ): RetrievalResult {
    return searchMemoryRecords(this.list(), input, accessContext, options);
  }

  promote(
    recordId: string,
    status: LifecycleStatus,
    accessContext?: MemoryAccessContext
  ): MemoryRecord | null {
    const record = this.records.get(recordId);
    if (!record) return null;

    const promotedRecord = createMemoryRecord({
      ...record,
      status: decodeLifecycleStatus(status),
      actor: accessContext ? toMemoryRecordActor(accessContext) : record.actor,
      updatedAt: new Date().toISOString()
    });
    this.records.set(recordId, promotedRecord);
    return promotedRecord;
  }

  debugSnapshot(
    limit = 50,
    accessContext?: MemoryAccessContext
  ): MemoryDebugSnapshot {
    return createMemoryDebugSnapshot(this.list(), limit, accessContext);
  }
}
