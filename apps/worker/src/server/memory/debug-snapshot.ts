import {
  canAccessMemoryRecord,
  createLocalMemoryAccessContext,
  toMemoryRecordActor,
  type MemoryAccessContext
} from "./access";
import type { MemoryDebugSnapshot } from "./contract";
import type { MemoryRecord } from "./types";

export function createMemoryDebugSnapshot(
  records: readonly MemoryRecord[],
  limit = 50,
  accessContext: MemoryAccessContext = createLocalMemoryAccessContext()
): MemoryDebugSnapshot {
  const visibleRecords = records.filter((record) =>
    canAccessMemoryRecord(record, accessContext)
  );

  return {
    generatedAt: new Date().toISOString(),
    identity: toMemoryRecordActor(accessContext),
    recordCount: visibleRecords.length,
    countsByKind: countBy(visibleRecords, "kind"),
    countsByStatus: countBy(visibleRecords, "status"),
    countsByScope: countBy(visibleRecords, "scope"),
    records: visibleRecords.slice(0, limit),
    recentRoutes: visibleRecords
      .filter((record) => record.kind === "route_record")
      .slice(0, 10)
  };
}

function countBy<Key extends "kind" | "status" | "scope">(
  records: readonly MemoryRecord[],
  key: Key
): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record[key]] = (counts[record[key]] ?? 0) + 1;
    return counts;
  }, {});
}
