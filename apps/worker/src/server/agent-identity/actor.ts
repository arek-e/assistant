import type { MemoryAccessContext } from "../memory/access";
import type {
  ActorContext,
  AgentActorContext,
  AgentCapability,
  AgentIdentity,
  AgentKey,
  SponsorActorContext
} from "./types";

const supportedAgentCapabilities = [
  "memory:read",
  "memory:write",
  "memory:lifecycle",
  "routing:write",
  "tools:schedule"
] as const satisfies readonly AgentCapability[];

export function toSponsorActorContext(accessContext: MemoryAccessContext): SponsorActorContext {
  return {
    subjectId: accessContext.sponsor?.subjectId ?? accessContext.subjectId,
    displayName: accessContext.sponsor?.displayName ?? accessContext.displayName,
    role: accessContext.sponsor?.role ?? accessContext.role,
    permissions: [...(accessContext.sponsor?.permissions ?? accessContext.permissions)]
  };
}

export function toUserActorContext(accessContext: MemoryAccessContext): ActorContext {
  return {
    actorType: "user",
    displayName: accessContext.displayName,
    provider: accessContext.provider,
    organizationId: accessContext.organizationId,
    sessionId: accessContext.sessionId,
    sponsor: toSponsorActorContext(accessContext),
    grants: accessContext.grants.map((grant) => ({ ...grant }))
  };
}

export function toAgentActorContext(
  sponsorAccessContext: MemoryAccessContext,
  identity: AgentIdentity,
  key: AgentKey,
  sessionId: string
): ActorContext {
  const agent = toAgentContext(identity, key);
  const sponsor = toSponsorActorContext(sponsorAccessContext);

  return {
    actorType: "agent",
    displayName: `${sponsor.displayName} via ${identity.name}`,
    provider: sponsorAccessContext.provider,
    organizationId: identity.organizationId,
    sessionId,
    sponsor,
    agent,
    grants: identity.allowedScopes.map((grant) => ({ ...grant }))
  };
}

export function toAgentMemoryAccessContext(
  actor: ActorContext,
  capabilities: readonly AgentCapability[]
): MemoryAccessContext {
  return {
    subjectId: actor.agent?.identityId ?? actor.sponsor.subjectId,
    subjectType: actor.agent ? "agent" : "user",
    provider: actor.provider,
    displayName: actor.displayName,
    sessionId: actor.sessionId,
    organizationId: actor.organizationId,
    role: actor.sponsor.role,
    permissions: [...capabilities],
    grants: actor.grants.map((grant) => ({ ...grant })),
    sponsor: actor.sponsor,
    agent: actor.agent
  };
}

function inferSponsorCapabilities(accessContext: MemoryAccessContext): AgentCapability[] {
  const explicitCapabilities = accessContext.permissions.filter(
    (permission): permission is AgentCapability =>
      supportedAgentCapabilities.includes(permission as AgentCapability)
  );

  if (explicitCapabilities.length > 0) return uniqueCapabilities(explicitCapabilities);

  return [...supportedAgentCapabilities];
}

export function requestedCapabilities(
  accessContext: MemoryAccessContext,
  capabilities: readonly AgentCapability[] | undefined
): AgentCapability[] {
  const sponsorCapabilities = inferSponsorCapabilities(accessContext);
  const requested = capabilities?.length ? capabilities : sponsorCapabilities;
  return uniqueCapabilities(
    requested.filter((capability) => sponsorCapabilities.includes(capability))
  );
}

function toAgentContext(identity: AgentIdentity, key: AgentKey): AgentActorContext {
  return {
    identityId: identity.id,
    keyId: key.id,
    name: identity.name,
    actingMode: identity.actingMode,
    status: key.status,
    expiresAt: key.expiresAt
  };
}

function uniqueCapabilities(capabilities: readonly AgentCapability[]): AgentCapability[] {
  return [...new Set(capabilities)];
}
