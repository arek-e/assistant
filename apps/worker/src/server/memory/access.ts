import type { MemoryRecord, MemoryScope } from "./types";

export interface MemoryScopeGrant {
  scope: MemoryScope;
  scopeId: string;
}

export interface MemoryAccessContext {
  subjectId: string;
  grants: readonly MemoryScopeGrant[];
}

const localMemoryScopeIds = {
  private: "local-user",
  team: "default-team",
  org: "default-org",
  session: "local-session"
} as const;

export function createLocalMemoryAccessContext(): MemoryAccessContext {
  return {
    subjectId: localMemoryScopeIds.private,
    grants: [
      { scope: "private", scopeId: localMemoryScopeIds.private },
      { scope: "team", scopeId: localMemoryScopeIds.team },
      { scope: "org", scopeId: localMemoryScopeIds.org },
      { scope: "session", scopeId: localMemoryScopeIds.session }
    ]
  };
}

export function canAccessMemoryRecord(
  record: MemoryRecord,
  accessContext: MemoryAccessContext
): boolean {
  return accessContext.grants.some(
    (grant) => grant.scope === record.scope && grant.scopeId === record.scopeId
  );
}

export function findMemoryScopeId(
  accessContext: MemoryAccessContext,
  scope: MemoryScope
): string {
  return (
    accessContext.grants.find((grant) => grant.scope === scope)?.scopeId ??
    localMemoryScopeIds[scope]
  );
}

export function scopePrecedence(scope: MemoryScope): number {
  switch (scope) {
    case "org":
      return 4;
    case "team":
      return 3;
    case "private":
      return 2;
    case "session":
      return 1;
  }
}
