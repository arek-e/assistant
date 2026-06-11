import type { MemoryAccessContext, MemoryScopeGrant } from "../memory/access";

export type AgentActingMode = "obou" | "standalone";

export type AgentIdentityStatus = "active" | "expired" | "revoked" | "disabled";

export type AgentCapability =
  | "memory:read"
  | "memory:write"
  | "memory:lifecycle"
  | "routing:write"
  | "tools:schedule";

export interface SponsorActorContext {
  subjectId: string;
  displayName: string;
  role: string;
  permissions: readonly string[];
}

export interface AgentActorContext {
  identityId: string;
  keyId: string;
  name: string;
  actingMode: AgentActingMode;
  status: AgentIdentityStatus;
  expiresAt: string;
}

export interface ActorContext {
  actorType: "user" | "agent";
  displayName: string;
  provider: string;
  organizationId: string;
  sessionId: string;
  sponsor: SponsorActorContext;
  agent?: AgentActorContext;
  grants: readonly MemoryScopeGrant[];
}

export interface AgentIdentity {
  id: string;
  organizationId: string;
  sponsorSubjectId: string;
  sponsorDisplayName: string;
  name: string;
  description: string;
  actingMode: AgentActingMode;
  status: AgentIdentityStatus;
  allowedScopes: readonly MemoryScopeGrant[];
  allowedCapabilities: readonly AgentCapability[];
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  createdByActor: ActorContext;
  revokedAt?: string;
  revokedByActor?: ActorContext;
  revocationReason?: string;
  expiryWarningsSent?: readonly AgentExpiryWarning[];
  lastUsedAt?: string;
}

export interface AgentExpiryWarning {
  daysBefore: number;
  sentAt: string;
}

export interface AgentKey {
  id: string;
  agentIdentityId: string;
  status: AgentIdentityStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt?: string;
  revokedByActor?: ActorContext;
  revocationReason?: string;
  sessionVersion: number;
}

export interface AgentAuthorizationCode {
  codeHash: string;
  clientId: string;
  agentKeyId: string;
  sponsorSubjectId: string;
  organizationId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  requestedScopes: readonly AgentCapability[];
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
}

export interface AgentOAuthClient {
  id: string;
  organizationId: string;
  name: string;
  status: "active" | "disabled";
  redirectUris: readonly string[];
  allowedCapabilities: readonly AgentCapability[];
  allowLocalRedirects: boolean;
  createdAt: string;
  updatedAt: string;
  createdByActor: ActorContext;
  disabledAt?: string;
  disabledByActor?: ActorContext;
  disableReason?: string;
}

export interface AgentRefreshSession {
  id: string;
  refreshTokenHash: string;
  agentKeyId: string;
  agentIdentityId: string;
  sponsorSubjectId: string;
  organizationId: string;
  sessionVersion: number;
  capabilities: readonly AgentCapability[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface AgentAuditEvent {
  id: string;
  eventType: AgentAuditEventType;
  occurredAt: string;
  organizationId: string;
  sponsorSubjectId: string;
  agentIdentityId?: string;
  agentKeyId?: string;
  actorContext: ActorContext;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
}

export type AgentAuditEventType =
  | "agent.created"
  | "agent.authorized"
  | "agent.token_exchanged"
  | "agent.refreshed"
  | "agent.renewed"
  | "agent.revoked"
  | "agent.expired"
  | "agent.expiry_warning"
  | "agent.disabled"
  | "agent.runtime_action"
  | "oauth_client.created"
  | "oauth_client.disabled";

export interface CreatedAgentIdentity {
  identity: AgentIdentity;
  key: AgentKey;
}

export interface AgentAccessTokenClaims {
  iss: "teampitch-agent";
  typ: "agent_access";
  sub: string;
  sid: string;
  org: string;
  sponsor: SponsorActorContext;
  agent: AgentActorContext;
  grants: MemoryScopeGrant[];
  capabilities: AgentCapability[];
  sessionVersion: number;
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface AgentTokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: "Bearer";
}

export interface AgentTokenExchangeResult {
  identity: AgentIdentity;
  key: AgentKey;
  tokens: AgentTokenPair;
  capabilities: readonly AgentCapability[];
}

export interface AgentIdentityCreateInput {
  actor: MemoryAccessContext;
  name: string;
  description?: string;
  actingMode?: AgentActingMode;
  allowedScopes?: readonly MemoryScopeGrant[];
  allowedCapabilities?: readonly AgentCapability[];
  expiresAt?: string;
  now?: Date;
}

export interface AgentIdentityRenewInput {
  actor: MemoryAccessContext;
  keyId: string;
  expiresAt: string;
  now?: Date;
}

export interface AgentIdentityRevokeInput {
  actor: MemoryAccessContext;
  keyId: string;
  reason?: string;
  now?: Date;
}

export interface AgentAuthorizationCodeInput {
  actor: MemoryAccessContext;
  agentKeyId?: string;
  agentName?: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  requestedScopes?: readonly AgentCapability[];
  now?: Date;
}

export interface AgentAuthorizationCodeResult {
  code: string;
  redirectUri: string;
  state?: string;
  identity: AgentIdentity;
  key: AgentKey;
}

export interface AgentAuthorizationCodeExchangeInput {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  now?: Date;
}

export interface AgentRefreshInput {
  refreshToken: string;
  now?: Date;
}

export interface AgentRefreshRevokeInput {
  refreshToken: string;
  reason?: string;
  now?: Date;
}

export interface AgentOAuthClientCreateInput {
  actor: MemoryAccessContext;
  clientId?: string;
  name: string;
  redirectUris: readonly string[];
  allowedCapabilities?: readonly AgentCapability[];
  allowLocalRedirects?: boolean;
  now?: Date;
}

export interface AgentOAuthClientDisableInput {
  actor: MemoryAccessContext;
  clientId: string;
  reason?: string;
  now?: Date;
}
