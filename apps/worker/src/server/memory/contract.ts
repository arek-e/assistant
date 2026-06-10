import type { RetrievalResult, SearchMemoryOptions } from "./retrieval";
import type { LifecycleStatus, MemoryRecord } from "./types";

export interface MemoryDebugSnapshot {
  generatedAt: string;
  recordCount: number;
  countsByKind: Record<string, number>;
  countsByStatus: Record<string, number>;
  records: MemoryRecord[];
  recentRoutes: MemoryRecord[];
}

export interface CanonicalMemoryStore {
  upsert(record: MemoryRecord): MemoryRecord;
  seed(records: readonly MemoryRecord[]): void;
  list(): MemoryRecord[];
  search(input: string, options?: SearchMemoryOptions): RetrievalResult;
  promote(recordId: string, status: LifecycleStatus): MemoryRecord | null;
  debugSnapshot(limit?: number): MemoryDebugSnapshot;
}
