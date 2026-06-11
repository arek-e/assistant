import { describe, expect, test } from "bun:test";

import type { MemoryAccessContext } from "./access";
import { InMemoryCanonicalMemoryStore } from "./canonical-memory-store";
import { createMemoryPrimitiveTools } from "./tools";
import type { MemoryRecordDraft } from "./types";

function toolOptions<T extends (...args: never[]) => unknown>(_tool: T): Parameters<T>[1] {
  return {} as Parameters<T>[1];
}

describe("memory primitive tools", () => {
  test("blocks writes outside the resolved grants", async () => {
    const store = new InMemoryCanonicalMemoryStore();
    const tools = createMemoryPrimitiveTools(store, privateOnlyContext());
    const execute = tools.recordMemory.execute;
    expect(execute).toBeDefined();
    if (!execute) throw new Error("recordMemory tool is missing execute");

    const result = await execute(
      {
        id: "decision.denied",
        kind: "decision_record",
        scope: "team",
        scopeId: "default-team",
        status: "active",
        title: "Denied team memory",
        body: "This should not be written.",
        evidence: "unit test",
        rationale: "covers write grant enforcement",
        reEvalTrigger: "when auth grants change",
        consumerRules: ["Use in tests only"],
        tags: ["auth"],
        supersedes: []
      },
      toolOptions(execute)
    );

    expect(result).toMatchObject({
      saved: false,
      error: "Access denied for memory scope team:default-team"
    });
    expect(store.list()).toEqual([]);
  });

  test("writes actor metadata and search provenance from the resolved grants", async () => {
    const accessContext = teamContext();
    const store = new InMemoryCanonicalMemoryStore();
    const tools = createMemoryPrimitiveTools(store, async () => accessContext);
    const recordMemory = tools.recordMemory.execute;
    const searchMemory = tools.searchMemory.execute;
    expect(recordMemory).toBeDefined();
    expect(searchMemory).toBeDefined();
    if (!recordMemory || !searchMemory) {
      throw new Error("memory tools are missing execute");
    }

    await recordMemory(
      {
        id: "decision.identity.slice",
        kind: "decision_record",
        scope: "team",
        scopeId: "team-123",
        status: "active",
        title: "Use WorkOS Auth Slice",
        body: "Resolve memory grants through auth identity.",
        evidence: "unit test",
        rationale: "covers actor-aware writes",
        reEvalTrigger: "when auth identity changes",
        consumerRules: ["Use in tests only"],
        tags: ["workos", "auth"],
        supersedes: []
      },
      toolOptions(recordMemory)
    );

    const [record] = store.list();
    expect(record?.actor).toMatchObject({
      subjectId: "user-123",
      subjectType: "user",
      provider: "workos"
    });

    const result = await searchMemory({ query: "WorkOS Auth Slice" }, toolOptions(searchMemory));

    expect(result.provenance).toMatchObject({
      subjectId: "user-123",
      subjectType: "user",
      provider: "workos"
    });
    expect(result.provenance.grants).toContainEqual({
      scope: "team",
      scopeId: "team-123"
    });
  });

  test("blocks promotion of inaccessible records", async () => {
    const store = new InMemoryCanonicalMemoryStore([
      createRecord({
        id: "decision.other-private",
        scope: "private",
        scopeId: "other-user"
      })
    ]);
    const tools = createMemoryPrimitiveTools(store, privateOnlyContext());
    const execute = tools.promoteRecord.execute;
    expect(execute).toBeDefined();
    if (!execute) throw new Error("promoteRecord tool is missing execute");

    const result = await execute(
      {
        recordId: "decision.other-private",
        status: "active"
      },
      toolOptions(execute)
    );

    expect(result).toMatchObject({
      promoted: false,
      error: "Access denied for memory record decision.other-private"
    });
  });

  test("writes agent actor metadata to route records", async () => {
    const accessContext = agentContext();
    const store = new InMemoryCanonicalMemoryStore();
    const tools = createMemoryPrimitiveTools(store, accessContext);
    const execute = tools.routeTask.execute;
    expect(execute).toBeDefined();
    if (!execute) throw new Error("routeTask tool is missing execute");

    await execute({ input: "implement the approval workflow" }, toolOptions(execute));

    const routeRecord = store.list().find((record) => record.kind === "route_record");
    expect(routeRecord?.actor).toMatchObject({
      subjectId: "agent-123",
      subjectType: "agent",
      displayName: "Sarah via Codex",
      sponsor: { subjectId: "user-123", displayName: "Sarah" },
      agent: { identityId: "agent-123", keyId: "ak-123", name: "Codex" }
    });
    expect(JSON.parse(routeRecord?.body ?? "{}").actor).toMatchObject({
      displayName: "Sarah via Codex",
      agent: { keyId: "ak-123" }
    });
  });
});

function privateOnlyContext(): MemoryAccessContext {
  return {
    subjectId: "user-123",
    subjectType: "user",
    provider: "workos",
    displayName: "Test User",
    sessionId: "session-123",
    organizationId: "",
    role: "",
    permissions: ["memory:read"],
    grants: [
      { scope: "private", scopeId: "user-123" },
      { scope: "session", scopeId: "session-123" }
    ]
  };
}

function teamContext(): MemoryAccessContext {
  return {
    ...privateOnlyContext(),
    organizationId: "org-123",
    role: "admin",
    permissions: ["memory:read", "memory:write"],
    grants: [
      { scope: "private", scopeId: "user-123" },
      { scope: "team", scopeId: "team-123" },
      { scope: "org", scopeId: "org-123" },
      { scope: "session", scopeId: "session-123" }
    ]
  };
}

function agentContext(): MemoryAccessContext {
  return {
    subjectId: "agent-123",
    subjectType: "agent",
    provider: "workos",
    displayName: "Sarah via Codex",
    sessionId: "agent-session-123",
    organizationId: "org-123",
    role: "admin",
    permissions: ["memory:read", "routing:write"],
    grants: [
      { scope: "org", scopeId: "org-123" },
      { scope: "session", scopeId: "agent-session-123" }
    ],
    sponsor: {
      subjectId: "user-123",
      displayName: "Sarah",
      role: "admin",
      permissions: ["memory:read", "routing:write"]
    },
    agent: {
      identityId: "agent-123",
      keyId: "ak-123",
      name: "Codex",
      actingMode: "obou",
      status: "active",
      expiresAt: "2026-07-10T00:00:00.000Z"
    }
  };
}

function createRecord(
  overrides: Pick<MemoryRecordDraft, "id" | "scope" | "scopeId">
): MemoryRecordDraft {
  const now = new Date("2026-06-10T00:00:00.000Z").toISOString();

  return {
    id: overrides.id,
    kind: "decision_record",
    scope: overrides.scope,
    scopeId: overrides.scopeId,
    status: "proposed",
    title: "Private decision",
    body: "Private decision body",
    evidence: "unit test",
    rationale: "covers promotion auth",
    createdAt: now,
    updatedAt: now,
    reEvalTrigger: "when auth grants change",
    consumerRules: ["Use in tests only"],
    tags: ["auth"],
    supersedes: []
  };
}
