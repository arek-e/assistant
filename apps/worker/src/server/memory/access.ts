import type {
  AuthSubjectType,
  MemoryRecord,
  MemoryRecordActor,
  MemoryScope,
  MemoryScopeGrant
} from "./types";

export type { MemoryScopeGrant } from "./types";

export interface MemoryAccessContext {
  subjectId: string;
  subjectType: AuthSubjectType;
  provider: string;
  displayName: string;
  sessionId: string;
  organizationId: string;
  role: string;
  permissions: readonly string[];
  grants: readonly MemoryScopeGrant[];
  sponsor?: MemoryRecordActor["sponsor"];
  agent?: MemoryRecordActor["agent"];
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
    subjectType: "user",
    provider: "local",
    displayName: "Local User",
    sessionId: localMemoryScopeIds.session,
    organizationId: localMemoryScopeIds.org,
    role: "local-admin",
    permissions: [
      "memory:read",
      "memory:write",
      "memory:lifecycle",
      "routing:write",
      "tools:schedule"
    ],
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
  return canUseMemoryScope(record.scope, record.scopeId, accessContext);
}

export function canUseMemoryScope(
  scope: MemoryScope,
  scopeId: string,
  accessContext: MemoryAccessContext
): boolean {
  return accessContext.grants.some((grant) => grant.scope === scope && grant.scopeId === scopeId);
}

export function findMemoryScopeGrant(
  accessContext: MemoryAccessContext,
  scope: MemoryScope
): MemoryScopeGrant | undefined {
  return accessContext.grants.find((grant) => grant.scope === scope);
}

export function findMemoryScopeId(accessContext: MemoryAccessContext, scope: MemoryScope): string {
  return findMemoryScopeGrant(accessContext, scope)?.scopeId ?? localMemoryScopeIds[scope];
}

export function toMemoryRecordActor(accessContext: MemoryAccessContext): MemoryRecordActor {
  return {
    subjectId: accessContext.subjectId,
    subjectType: accessContext.subjectType,
    provider: accessContext.provider,
    displayName: accessContext.displayName,
    sessionId: accessContext.sessionId,
    organizationId: accessContext.organizationId,
    role: accessContext.role,
    permissions: [...accessContext.permissions],
    grants: accessContext.grants.map((grant) => ({ ...grant })),
    sponsor: accessContext.sponsor,
    agent: accessContext.agent
  };
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
