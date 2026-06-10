import type { MemoryDebugSnapshot } from "./contract";
import type { MemoryRecord } from "./types";

export function createMemoryDebugSnapshot(
  records: readonly MemoryRecord[],
  limit = 50
): MemoryDebugSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    countsByKind: countBy(records, "kind"),
    countsByStatus: countBy(records, "status"),
    countsByScope: countBy(records, "scope"),
    records: records.slice(0, limit),
    recentRoutes: records.filter((record) => record.kind === "route_record").slice(0, 10)
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
