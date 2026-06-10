import type { MemoryAccessContext } from "./access";
import type { RetrievalResult, SearchMemoryOptions } from "./retrieval";
import type { LifecycleStatus, MemoryRecord, MemoryRecordDraft } from "./types";

export interface MemoryDebugSnapshot {
  generatedAt: string;
  recordCount: number;
  countsByKind: Record<string, number>;
  countsByStatus: Record<string, number>;
  countsByScope: Record<string, number>;
  records: MemoryRecord[];
  recentRoutes: MemoryRecord[];
}

export interface CanonicalMemoryStore {
  upsert(record: MemoryRecordDraft): MemoryRecord;
  seed(records: readonly MemoryRecordDraft[]): void;
  list(): MemoryRecord[];
  search(
    input: string,
    accessContext: MemoryAccessContext,
    options?: SearchMemoryOptions
  ): RetrievalResult;
  promote(recordId: string, status: LifecycleStatus): MemoryRecord | null;
  debugSnapshot(limit?: number): MemoryDebugSnapshot;
}
