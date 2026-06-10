import type { MemoryAccessContext } from "./access";
import type { RetrievalResult, SearchMemoryOptions } from "./retrieval";
import type { LifecycleStatus, MemoryRecord, MemoryRecordActor, MemoryRecordDraft } from "./types";

export interface MemoryDebugSnapshot {
  generatedAt: string;
  identity: MemoryRecordActor;
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
  promote(
    recordId: string,
    status: LifecycleStatus,
    accessContext?: MemoryAccessContext
  ): MemoryRecord | null;
  debugSnapshot(limit?: number, accessContext?: MemoryAccessContext): MemoryDebugSnapshot;
}
