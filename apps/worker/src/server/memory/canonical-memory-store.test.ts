import { describe, expect, test } from "bun:test";
import { InMemoryCanonicalMemoryStore } from "./canonical-memory-store";
import type { MemoryRecord } from "./types";

describe("InMemoryCanonicalMemoryStore", () => {
  test("searches active records and hides rejected records by default", () => {
    const store = new InMemoryCanonicalMemoryStore([
      createRecord({
        id: "decision.icons.hugeicons",
        status: "active",
        title: "Use Hugeicons"
      }),
      createRecord({
        id: "decision.icons.lucide",
        status: "rejected",
        title: "Use Lucide"
      })
    ]);

    const result = store.search("which icon system should the app use?");

    expect(result.hits.map((hit) => hit.record.id)).toEqual([
      "decision.icons.hugeicons"
    ]);
    expect(result.blockedRecordIds).toEqual(["decision.icons.lucide"]);
  });

  test("promotes records through the lifecycle", () => {
    const store = new InMemoryCanonicalMemoryStore([
      createRecord({
        id: "decision.memory.sqlite",
        status: "proposed",
        title: "Use SQLite memory"
      })
    ]);

    const promoted = store.promote("decision.memory.sqlite", "active");

    expect(promoted?.status).toBe("active");
    expect(store.search("SQLite memory").hits[0]?.record.status).toBe("active");
  });
});

function createRecord(
  overrides: Pick<MemoryRecord, "id" | "status" | "title">
): MemoryRecord {
  const now = new Date("2026-06-10T00:00:00.000Z").toISOString();

  return {
    id: overrides.id,
    kind: "decision_record",
    scope: "project",
    status: overrides.status,
    title: overrides.title,
    body: overrides.title,
    evidence: "unit test fixture",
    rationale: "covers the in-memory primitive contract",
    createdAt: now,
    updatedAt: now,
    reEvalTrigger: "when the primitive contract changes",
    consumerRules: ["Use in tests only"],
    tags: ["icons", "memory", "sqlite"],
    supersedes: []
  };
}
