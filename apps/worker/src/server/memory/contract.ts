import type { MemoryAccessContext } from "./access";
import type { RetrievalResult, SearchMemoryOptions } from "./retrieval";
import type { MemoryScopeGrant } from "./types";
import type { LifecycleStatus, MemoryRecord, MemoryRecordDraft } from "./types";

export interface MemoryDebugSnapshot {
  generatedAt: string;
  identity: {
    subjectId: string;
    subjectType: string;
    provider: string;
    displayName: string;
    sessionId: string;
    organizationId: string;
    role: string;
    permissions: string[];
    grants: MemoryScopeGrant[];
  };
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
  debugSnapshot(
    limit?: number,
    accessContext?: MemoryAccessContext
  ): MemoryDebugSnapshot;
}
