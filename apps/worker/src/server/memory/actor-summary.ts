import type { MemoryAccessContext } from "./access";

export function summarizeMemoryAccessContext(accessContext: MemoryAccessContext) {
  return {
    subjectId: accessContext.subjectId,
    subjectType: accessContext.subjectType,
    provider: accessContext.provider,
    displayName: accessContext.displayName,
    organizationId: accessContext.organizationId,
    sessionId: accessContext.sessionId,
    role: accessContext.role,
    permissions: [...accessContext.permissions],
    grants: accessContext.grants.map((grant) => ({ ...grant })),
    sponsor: accessContext.sponsor,
    agent: accessContext.agent
  };
}
