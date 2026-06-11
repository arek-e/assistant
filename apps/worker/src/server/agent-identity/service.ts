import type { MemoryAccessContext, MemoryScopeGrant } from "../memory/access";
import {
  requestedCapabilities,
  toAgentActorContext,
  toAgentMemoryAccessContext,
  toSponsorActorContext,
  toUserActorContext
} from "./actor";
import type { AgentIdentityStore } from "./store";
import {
  authorizationCodeExpiresAt,
  createAgentTokenPair,
  createAuthorizationCode,
  hashToken,
  tokenScope,
  verifyPkceChallenge
} from "./tokens";
import type {
  ActorContext,
  AgentAccessTokenClaims,
  AgentAuditEvent,
  AgentAuditEventType,
  AgentAuthorizationCode,
  AgentAuthorizationCodeExchangeInput,
  AgentAuthorizationCodeInput,
  AgentAuthorizationCodeResult,
  AgentCapability,
  AgentIdentity,
  AgentIdentityCreateInput,
  AgentIdentityRenewInput,
  AgentIdentityRevokeInput,
  AgentIdentityStatus,
  AgentKey,
  AgentOAuthClient,
  AgentOAuthClientCreateInput,
  AgentOAuthClientDisableInput,
  AgentRefreshInput,
  AgentRefreshRevokeInput,
  AgentRefreshSession,
  AgentTokenExchangeResult,
  CreatedAgentIdentity
} from "./types";

const defaultAgentName = "Assistant Agent";
const defaultExpiryDays = 30;
const defaultExpiryWarningDays = [14, 7, 1] as const;

export interface AgentIdentityServiceOptions {
  accessTokenSecret: string;
  policy?: AgentIdentityPolicy;
  sponsorValidator?: AgentSponsorValidator;
}

export interface AgentIdentityPolicy {
  creationDisabled?: boolean;
  maxExpiryDays?: number;
  allowedCapabilities?: readonly AgentCapability[];
  allowedCapabilitiesByRole?: Record<string, readonly AgentCapability[]>;
  allowedRedirectUris?: readonly string[];
}

export interface AgentSponsorValidationInput {
  identity: AgentIdentity;
  key: AgentKey;
}

export type AgentSponsorValidationResult = { valid: true } | { valid: false; reason: string };

export type AgentSponsorValidator = (
  input: AgentSponsorValidationInput
) => Promise<AgentSponsorValidationResult>;

export interface AgentIdentityListOptions {
  includeAllSponsors?: boolean;
  sponsorSubjectId?: string;
  status?: AgentIdentity["status"];
  scope?: MemoryScopeGrant["scope"];
  expiresBefore?: string;
  lastUsedBefore?: string;
  lastUsedAfter?: string;
}

export interface AgentLifecycleMaintenanceInput {
  now?: Date;
  expiryWarningDays?: readonly number[];
}

export interface AgentLifecycleMaintenanceResult {
  checked: number;
  expired: number;
  expiryWarningsSent: number;
  expiredRefreshSessionsRevoked: number;
}

export interface AgentRuntimeActionInput {
  actor: MemoryAccessContext;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export class AgentIdentityService {
  constructor(
    private readonly store: AgentIdentityStore,
    private readonly options: AgentIdentityServiceOptions
  ) {}

  async createIdentity(input: AgentIdentityCreateInput): Promise<CreatedAgentIdentity> {
    const now = input.now ?? new Date();
    const expiresAt = input.expiresAt ?? addDays(now, defaultExpiryDays).toISOString();

    if (input.actingMode === "standalone") {
      throw new AgentIdentityError("standalone_not_enabled", "Standalone agents are not enabled");
    }
    assertAgentCreationAllowed(this.options.policy);
    assertFuture(expiresAt, now, "Agent keys require a future expiration date");
    assertWithinMaxExpiry(expiresAt, now, this.options.policy);

    const allowedScopes = validateAllowedScopes(
      input.actor,
      input.allowedScopes ?? input.actor.grants
    );
    const allowedCapabilities = applyCapabilityPolicy(
      input.actor,
      requestedCapabilities(input.actor, input.allowedCapabilities),
      this.options.policy
    );
    if (allowedCapabilities.length === 0) {
      throw new AgentIdentityError(
        "capability_denied",
        "No requested agent capabilities are available to the sponsor"
      );
    }

    const actor = toUserActorContext(input.actor);
    const identityId = createId("agent");
    const keyId = createId("ak");
    const timestamp = now.toISOString();
    const identity: AgentIdentity = {
      id: identityId,
      organizationId: input.actor.organizationId,
      sponsorSubjectId: toSponsorActorContext(input.actor).subjectId,
      sponsorDisplayName: toSponsorActorContext(input.actor).displayName,
      name: input.name || defaultAgentName,
      description: input.description ?? "",
      actingMode: "obou",
      status: "active",
      allowedScopes,
      allowedCapabilities,
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByActor: actor
    };
    const key: AgentKey = {
      id: keyId,
      agentIdentityId: identityId,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt,
      sessionVersion: 1
    };

    await this.store.upsertIdentity(identity);
    await this.store.upsertKey(key);
    await this.audit("agent.created", actor, {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_identity",
      targetId: identity.id,
      metadata: {
        name: identity.name,
        capabilities: identity.allowedCapabilities,
        scopes: identity.allowedScopes
      }
    });

    return { identity, key };
  }

  async listIdentities(
    actor: MemoryAccessContext,
    options: AgentIdentityListOptions = {}
  ): Promise<AgentIdentity[]> {
    const admin = options.includeAllSponsors && isAdmin(actor);
    const identities = await this.store.listIdentities({
      organizationId: actor.organizationId,
      sponsorSubjectId: admin ? options.sponsorSubjectId : toSponsorActorContext(actor).subjectId,
      includeAllSponsors: admin
    });
    return filterIdentities(identities, options);
  }

  async getIdentityForActor(
    actor: MemoryAccessContext,
    identityId: string
  ): Promise<AgentIdentity | null> {
    const identity = await this.store.getIdentity(identityId);
    if (!identity || !canViewIdentity(actor, identity)) return null;
    return identity;
  }

  async createOAuthClient(input: AgentOAuthClientCreateInput): Promise<AgentOAuthClient> {
    assertAdmin(input.actor, "Only admins can create OAuth clients");

    const now = input.now ?? new Date();
    const timestamp = now.toISOString();
    const redirectUris = normalizeRedirectUris(input.redirectUris);
    if (redirectUris.length === 0 && !input.allowLocalRedirects) {
      throw new AgentIdentityError(
        "invalid_redirect_uri",
        "OAuth clients require a redirect URI or local redirects"
      );
    }
    assertRedirectUrisAllowedByPolicy(redirectUris, this.options.policy);
    const client: AgentOAuthClient = {
      id: input.clientId || createId("aoc"),
      organizationId: input.actor.organizationId,
      name: input.name,
      status: "active",
      redirectUris,
      allowedCapabilities: applyCapabilityPolicy(
        input.actor,
        requestedCapabilities(input.actor, input.allowedCapabilities),
        this.options.policy
      ),
      allowLocalRedirects: input.allowLocalRedirects ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByActor: toUserActorContext(input.actor)
    };

    await this.store.upsertOAuthClient(client);
    await this.audit("oauth_client.created", client.createdByActor, {
      targetType: "oauth_client",
      targetId: client.id,
      metadata: {
        name: client.name,
        redirectUris: client.redirectUris,
        allowedCapabilities: client.allowedCapabilities,
        allowLocalRedirects: client.allowLocalRedirects
      }
    });

    return client;
  }

  async listOAuthClients(
    actor: MemoryAccessContext,
    status?: AgentOAuthClient["status"]
  ): Promise<AgentOAuthClient[]> {
    assertAdmin(actor, "Only admins can list OAuth clients");
    return this.store.listOAuthClients({
      organizationId: actor.organizationId,
      status
    });
  }

  async disableOAuthClient(input: AgentOAuthClientDisableInput): Promise<AgentOAuthClient> {
    assertAdmin(input.actor, "Only admins can disable OAuth clients");

    const client = await this.store.getOAuthClient(input.actor.organizationId, input.clientId);
    if (!client) {
      throw new AgentIdentityError("oauth_client_not_found", "OAuth client not found", 404);
    }

    const disabledAt = (input.now ?? new Date()).toISOString();
    const actor = toUserActorContext(input.actor);
    const disabledClient: AgentOAuthClient = {
      ...client,
      status: "disabled",
      disabledAt,
      disabledByActor: actor,
      disableReason: input.reason ?? "disabled",
      updatedAt: disabledAt
    };

    await this.store.upsertOAuthClient(disabledClient);
    await this.audit("oauth_client.disabled", actor, {
      targetType: "oauth_client",
      targetId: client.id,
      metadata: { reason: disabledClient.disableReason }
    });

    return disabledClient;
  }

  async renewKey(input: AgentIdentityRenewInput): Promise<AgentKey> {
    const now = input.now ?? new Date();
    assertFuture(input.expiresAt, now, "Renewal requires a future expiration date");
    assertWithinMaxExpiry(input.expiresAt, now, this.options.policy);

    const { identity, key } = await this.requireMutableKey(input.actor, input.keyId);
    if (key.status === "revoked") {
      throw new AgentIdentityError("key_revoked", "Revoked agent keys cannot be renewed");
    }

    const updatedAt = now.toISOString();
    const renewedKey: AgentKey = {
      ...key,
      status: "active",
      expiresAt: input.expiresAt,
      updatedAt
    };
    const renewedIdentity: AgentIdentity = {
      ...identity,
      status: "active",
      expiresAt: input.expiresAt,
      expiryWarningsSent: [],
      updatedAt
    };

    await this.store.upsertKey(renewedKey);
    await this.store.upsertIdentity(renewedIdentity);
    await this.audit("agent.renewed", toUserActorContext(input.actor), {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_key",
      targetId: key.id,
      metadata: { expiresAt: input.expiresAt }
    });

    return renewedKey;
  }

  async renewIdentity(input: AgentIdentityRenewInput): Promise<AgentKey> {
    const key = await this.store.getKeyByIdentityId(input.keyId);
    if (!key) throw new AgentIdentityError("key_not_found", "Agent key not found");
    return this.renewKey({ ...input, keyId: key.id });
  }

  async revokeKey(input: AgentIdentityRevokeInput): Promise<AgentKey> {
    const now = input.now ?? new Date();
    const { identity, key } = await this.requireMutableKey(input.actor, input.keyId);
    const revokedAt = now.toISOString();
    const actor = toUserActorContext(input.actor);
    const reason = input.reason ?? "revoked";
    const revokedKey: AgentKey = {
      ...key,
      status: "revoked",
      revokedAt,
      revokedByActor: actor,
      revocationReason: reason,
      sessionVersion: key.sessionVersion + 1,
      updatedAt: revokedAt
    };
    const revokedIdentity: AgentIdentity = {
      ...identity,
      status: "revoked",
      revokedAt,
      revokedByActor: actor,
      revocationReason: reason,
      updatedAt: revokedAt
    };

    await this.store.upsertKey(revokedKey);
    await this.store.upsertIdentity(revokedIdentity);
    await this.audit("agent.revoked", actor, {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_key",
      targetId: key.id,
      metadata: { reason }
    });

    return revokedKey;
  }

  async revokeIdentity(input: AgentIdentityRevokeInput): Promise<AgentKey> {
    const key = await this.store.getKeyByIdentityId(input.keyId);
    if (!key) throw new AgentIdentityError("key_not_found", "Agent key not found");
    return this.revokeKey({ ...input, keyId: key.id });
  }

  async disableIdentity(input: AgentIdentityRevokeInput): Promise<AgentKey> {
    const key = await this.store.getKeyByIdentityId(input.keyId);
    if (!key) throw new AgentIdentityError("key_not_found", "Agent key not found");
    return this.disableKey({ ...input, keyId: key.id });
  }

  async createAuthorizationCode(
    input: AgentAuthorizationCodeInput
  ): Promise<AgentAuthorizationCodeResult> {
    const now = input.now ?? new Date();
    if (input.codeChallengeMethod !== "S256") {
      throw new AgentIdentityError("invalid_pkce_method", "Only S256 PKCE is accepted");
    }
    const oauthClient = await this.requireOAuthClient(input);
    const requested = intersectCapabilities(
      oauthClient.allowedCapabilities,
      applyCapabilityPolicy(
        input.actor,
        requestedCapabilities(input.actor, input.requestedScopes),
        this.options.policy
      )
    );

    const { identity, key } = input.agentKeyId
      ? await this.requireMutableKey(input.actor, input.agentKeyId)
      : await this.createIdentity({
          actor: input.actor,
          name: input.agentName || input.clientId || defaultAgentName,
          allowedCapabilities: requested,
          now
        });

    await assertKeyUsable(this.store, identity, key, now);
    assertCapabilitiesWithin(identity.allowedCapabilities, requested);

    const code = createAuthorizationCode();
    const codeHash = await hashToken(code);
    const record: AgentAuthorizationCode = {
      codeHash,
      clientId: oauthClient.id,
      agentKeyId: key.id,
      sponsorSubjectId: identity.sponsorSubjectId,
      organizationId: identity.organizationId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: "S256",
      requestedScopes: requested,
      expiresAt: authorizationCodeExpiresAt(now),
      createdAt: now.toISOString()
    };
    const actor = toUserActorContext(input.actor);

    await this.store.saveAuthorizationCode(record);
    await this.audit("agent.authorized", actor, {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_key",
      targetId: key.id,
      metadata: {
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        requestedScopes: requested
      }
    });

    return { code, redirectUri: input.redirectUri, identity, key };
  }

  async exchangeAuthorizationCode(
    input: AgentAuthorizationCodeExchangeInput
  ): Promise<AgentTokenExchangeResult> {
    const now = input.now ?? new Date();
    const codeHash = await hashToken(input.code);
    const code = await this.store.getAuthorizationCode(codeHash);
    if (!code) throw new AgentIdentityError("invalid_code", "Invalid authorization code");
    if (code.usedAt) throw new AgentIdentityError("code_used", "Authorization code already used");
    if (isPast(code.expiresAt, now)) {
      throw new AgentIdentityError("code_expired", "Authorization code expired");
    }
    if (code.redirectUri !== input.redirectUri) {
      throw new AgentIdentityError("redirect_uri_mismatch", "Redirect URI mismatch");
    }
    if (!(await verifyPkceChallenge(input.codeVerifier, code.codeChallenge))) {
      throw new AgentIdentityError("invalid_pkce_verifier", "Invalid PKCE verifier");
    }

    const { identity, key } = await this.requireKeyById(code.agentKeyId);
    await assertKeyUsable(this.store, identity, key, now);
    await validateSponsorAccess(this.store, identity, key, this.options.sponsorValidator, now);
    assertCapabilitiesWithin(identity.allowedCapabilities, code.requestedScopes);

    const capabilities = code.requestedScopes.map((capability) => capability);
    const tokens = await this.createSessionTokens(identity, key, capabilities, now);
    await this.store.markAuthorizationCodeUsed(codeHash, now.toISOString());
    await this.audit("agent.token_exchanged", actorForIdentity(identity, key), {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_key",
      targetId: key.id,
      metadata: { scope: tokenScope(code.requestedScopes) }
    });

    return { identity, key, tokens, capabilities };
  }

  async refresh(input: AgentRefreshInput): Promise<AgentTokenExchangeResult> {
    const now = input.now ?? new Date();
    const refreshTokenHash = await hashToken(input.refreshToken);
    const session = await this.store.getRefreshSession(refreshTokenHash);
    if (!session || session.revokedAt) {
      throw new AgentIdentityError("invalid_refresh_token", "Invalid refresh token");
    }
    if (isPast(session.expiresAt, now)) {
      throw new AgentIdentityError("refresh_expired", "Refresh token expired");
    }

    const { identity, key } = await this.requireKeyById(session.agentKeyId);
    await assertKeyUsable(this.store, identity, key, now);
    await validateSponsorAccess(this.store, identity, key, this.options.sponsorValidator, now);
    if (session.sessionVersion !== key.sessionVersion) {
      throw new AgentIdentityError("session_revoked", "Agent session version is revoked");
    }

    await this.store.revokeRefreshSession(refreshTokenHash, now.toISOString(), "rotated");
    const capabilities = intersectCapabilities(
      identity.allowedCapabilities,
      session.capabilities ?? identity.allowedCapabilities
    );
    const tokens = await this.createSessionTokens(identity, key, capabilities, now);
    await this.audit("agent.refreshed", actorForIdentity(identity, key), {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_key",
      targetId: key.id,
      metadata: {}
    });

    return { identity, key, tokens, capabilities };
  }

  async revokeRefreshToken(input: AgentRefreshRevokeInput): Promise<void> {
    const now = input.now ?? new Date();
    await this.store.revokeRefreshSession(
      await hashToken(input.refreshToken),
      now.toISOString(),
      input.reason ?? "revoked"
    );
  }

  async runLifecycleMaintenance(
    input: AgentLifecycleMaintenanceInput = {}
  ): Promise<AgentLifecycleMaintenanceResult> {
    const now = input.now ?? new Date();
    const warningDays = normalizeWarningDays(input.expiryWarningDays ?? defaultExpiryWarningDays);
    const expiresBefore = addDays(now, maxNumber(warningDays, 0)).toISOString();
    const identities = await this.store.listLifecycleIdentities({
      status: "active",
      expiresBefore
    });
    let expired = 0;
    let expiryWarningsSent = 0;

    for (const identity of identities) {
      const key = await this.store.getKeyByIdentityId(identity.id);
      if (!key) continue;

      if (isPast(identity.expiresAt, now) || isPast(key.expiresAt, now)) {
        await expireKey(this.store, identity, key, now);
        expired += 1;
        continue;
      }

      const warningDay = dueWarningDay(identity, now, warningDays);
      if (warningDay) {
        await sendExpiryWarning(this.store, identity, key, warningDay, now);
        expiryWarningsSent += 1;
      }
    }
    const expiredRefreshSessionsRevoked = await this.revokeExpiredRefreshSessions(now);

    return {
      checked: identities.length,
      expired,
      expiryWarningsSent,
      expiredRefreshSessionsRevoked
    };
  }

  private async disableKey(input: AgentIdentityRevokeInput): Promise<AgentKey> {
    const now = input.now ?? new Date();
    const { identity, key } = await this.requireMutableKey(input.actor, input.keyId);
    if (!isAdmin(input.actor)) {
      throw new AgentIdentityError("forbidden", "Only admins can disable agent keys");
    }

    const disabledAt = now.toISOString();
    const actor = toUserActorContext(input.actor);
    const reason = input.reason ?? "disabled";
    const disabledKey: AgentKey = {
      ...key,
      status: "disabled",
      revokedAt: disabledAt,
      revokedByActor: actor,
      revocationReason: reason,
      sessionVersion: key.sessionVersion + 1,
      updatedAt: disabledAt
    };
    const disabledIdentity: AgentIdentity = {
      ...identity,
      status: "disabled",
      revokedAt: disabledAt,
      revokedByActor: actor,
      revocationReason: reason,
      updatedAt: disabledAt
    };

    await this.store.upsertKey(disabledKey);
    await this.store.upsertIdentity(disabledIdentity);
    await this.audit("agent.disabled", actor, {
      agentIdentityId: identity.id,
      agentKeyId: key.id,
      targetType: "agent_key",
      targetId: key.id,
      metadata: { reason }
    });

    return disabledKey;
  }

  async listAuditEvents(
    actor: MemoryAccessContext,
    agentIdentityId?: string
  ): Promise<AgentAuditEvent[]> {
    const includeAllSponsors = isAdmin(actor);
    return this.store.listAuditEvents({
      organizationId: actor.organizationId,
      agentIdentityId,
      sponsorSubjectId: includeAllSponsors ? undefined : toSponsorActorContext(actor).subjectId
    });
  }

  async recordRuntimeAction(input: AgentRuntimeActionInput): Promise<void> {
    const actorContext = toRuntimeActorContext(input.actor);
    if (!actorContext.agent) return;

    await this.audit("agent.runtime_action", actorContext, {
      agentIdentityId: actorContext.agent.identityId,
      agentKeyId: actorContext.agent.keyId,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {}
    });
  }

  private async requireMutableKey(
    actor: MemoryAccessContext,
    keyId: string
  ): Promise<{ identity: AgentIdentity; key: AgentKey }> {
    const { identity, key } = await requireKeyById(this.store, keyId);
    if (!canMutateIdentity(actor, identity)) {
      throw new AgentIdentityError("forbidden", "Cannot mutate this agent key");
    }
    return { identity, key };
  }

  private async requireOAuthClient(input: AgentAuthorizationCodeInput): Promise<AgentOAuthClient> {
    const registered = await this.store.getOAuthClient(input.actor.organizationId, input.clientId);
    const client = registered ?? implicitOAuthClient(input.actor, input.clientId);

    if (!client) {
      throw new AgentIdentityError("oauth_client_not_found", "OAuth client is not registered", 404);
    }
    if (client.status !== "active") {
      throw new AgentIdentityError("oauth_client_disabled", "OAuth client is disabled", 403);
    }
    if (!isOAuthRedirectAllowed(client, input.redirectUri)) {
      throw new AgentIdentityError("invalid_redirect_uri", "Redirect URI is not allowed");
    }

    return client;
  }

  private async requireKeyById(keyId: string): Promise<{ identity: AgentIdentity; key: AgentKey }> {
    return requireKeyById(this.store, keyId);
  }

  private async createSessionTokens(
    identity: AgentIdentity,
    key: AgentKey,
    capabilities: readonly AgentCapability[],
    now: Date
  ) {
    const actor = actorForIdentity(identity, key);
    const tokens = await createAgentTokenPair(
      {
        sub: identity.id,
        sid: createId("as"),
        org: identity.organizationId,
        sponsor: actor.sponsor,
        agent: actor.agent!,
        grants: identity.allowedScopes.map((grant) => ({ ...grant })),
        capabilities: capabilities.map((capability) => capability),
        sessionVersion: key.sessionVersion
      },
      this.options.accessTokenSecret,
      now
    );
    const refreshSession: AgentRefreshSession = {
      id: createId("ars"),
      refreshTokenHash: await hashToken(tokens.refreshToken),
      agentKeyId: key.id,
      agentIdentityId: identity.id,
      sponsorSubjectId: identity.sponsorSubjectId,
      organizationId: identity.organizationId,
      sessionVersion: key.sessionVersion,
      capabilities: capabilities.map((capability) => capability),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: tokens.refreshTokenExpiresAt
    };
    const updatedAt = now.toISOString();

    await this.store.saveRefreshSession(refreshSession);
    await this.store.upsertIdentity({
      ...identity,
      lastUsedAt: updatedAt,
      updatedAt
    });

    return tokens;
  }

  private async revokeExpiredRefreshSessions(now: Date): Promise<number> {
    const expiredSessions = await this.store.listExpiredRefreshSessions({
      expiresBefore: now.toISOString()
    });

    await Promise.all(
      expiredSessions.map((session) =>
        this.store.revokeRefreshSession(
          session.refreshTokenHash,
          now.toISOString(),
          "expired_cleanup"
        )
      )
    );

    return expiredSessions.length;
  }

  private async audit(
    eventType: AgentAuditEventType,
    actorContext: ActorContext,
    event: Pick<
      AgentAuditEvent,
      "targetType" | "targetId" | "metadata" | "agentIdentityId" | "agentKeyId"
    >
  ): Promise<void> {
    await this.store.appendAuditEvent({
      id: createId("aae"),
      eventType,
      occurredAt: new Date().toISOString(),
      organizationId: actorContext.organizationId,
      sponsorSubjectId: actorContext.sponsor.subjectId,
      actorContext,
      ...event
    });
  }
}

export async function resolveAccessTokenClaims(
  store: AgentIdentityStore,
  claims: AgentAccessTokenClaims,
  fallbackSessionId?: string,
  sponsorValidator?: AgentSponsorValidator
): Promise<MemoryAccessContext> {
  const { identity, key } = await requireKeyById(store, claims.agent.keyId);
  const now = new Date();
  await assertKeyUsable(store, identity, key, now);
  await validateSponsorAccess(store, identity, key, sponsorValidator, now);
  if (claims.sessionVersion !== key.sessionVersion) {
    throw new AgentIdentityError("session_revoked", "Agent session version is revoked");
  }
  const grants = intersectGrants(identity.allowedScopes, claims.grants);
  const capabilities = intersectCapabilities(identity.allowedCapabilities, claims.capabilities);

  const actor: ActorContext = {
    actorType: "agent",
    displayName: `${identity.sponsorDisplayName} via ${identity.name}`,
    provider: "workos",
    organizationId: identity.organizationId,
    sessionId: claims.sid || fallbackSessionId || crypto.randomUUID(),
    sponsor: claims.sponsor,
    agent: {
      identityId: identity.id,
      keyId: key.id,
      name: identity.name,
      actingMode: identity.actingMode,
      status: key.status,
      expiresAt: key.expiresAt
    },
    grants
  };

  return toAgentMemoryAccessContext(actor, capabilities);
}

export class AgentIdentityError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = errorStatus(code)
  ) {
    super(message);
  }
}

export function toAgentIdentityError(caught: unknown): AgentIdentityError {
  return caught instanceof AgentIdentityError
    ? caught
    : new AgentIdentityError("agent_identity_error", "Agent identity error", 500);
}

function validateAllowedScopes(
  actor: MemoryAccessContext,
  requestedScopes: readonly MemoryScopeGrant[]
): MemoryScopeGrant[] {
  const grants = requestedScopes.filter((requested) =>
    actor.grants.some(
      (grant) => grant.scope === requested.scope && grant.scopeId === requested.scopeId
    )
  );
  if (grants.length === 0) {
    throw new AgentIdentityError(
      "scope_denied",
      "No requested agent scopes are available to the sponsor"
    );
  }

  return grants.map((grant) => ({ ...grant }));
}

function filterIdentities(
  identities: readonly AgentIdentity[],
  options: AgentIdentityListOptions
): AgentIdentity[] {
  return identities
    .filter((identity) => !options.status || identity.status === options.status)
    .filter(
      (identity) =>
        !options.scope || identity.allowedScopes.some((grant) => grant.scope === options.scope)
    )
    .filter((identity) => !options.expiresBefore || identity.expiresAt <= options.expiresBefore)
    .filter(
      (identity) =>
        !options.lastUsedBefore ||
        Boolean(identity.lastUsedAt && identity.lastUsedAt <= options.lastUsedBefore)
    )
    .filter(
      (identity) =>
        !options.lastUsedAfter ||
        Boolean(identity.lastUsedAt && identity.lastUsedAt >= options.lastUsedAfter)
    )
    .map((identity) => ({ ...identity }));
}

function assertAgentCreationAllowed(policy: AgentIdentityPolicy | undefined): void {
  if (policy?.creationDisabled) {
    throw new AgentIdentityError(
      "agent_creation_disabled",
      "Agent creation is disabled by policy",
      403
    );
  }
}

function assertWithinMaxExpiry(
  expiresAt: string,
  now: Date,
  policy: AgentIdentityPolicy | undefined
): void {
  if (!policy?.maxExpiryDays) return;
  const maxExpiresAt = addDays(now, policy.maxExpiryDays).toISOString();
  if (expiresAt > maxExpiresAt) {
    throw new AgentIdentityError("max_expiry_exceeded", "Agent expiry exceeds the policy maximum");
  }
}

function assertRedirectUrisAllowedByPolicy(
  redirectUris: readonly string[],
  policy: AgentIdentityPolicy | undefined
): void {
  if (!policy?.allowedRedirectUris?.length) return;

  const disallowed = redirectUris.some(
    (redirectUri) => !policy.allowedRedirectUris?.includes(redirectUri)
  );
  if (disallowed) {
    throw new AgentIdentityError(
      "invalid_redirect_uri",
      "OAuth client redirect URI is outside policy"
    );
  }
}

function applyCapabilityPolicy(
  actor: MemoryAccessContext,
  capabilities: readonly AgentCapability[],
  policy: AgentIdentityPolicy | undefined
): AgentCapability[] {
  const allowed = policyCapabilities(actor, policy);
  if (!allowed) return [...capabilities];

  return intersectCapabilities(allowed, capabilities);
}

function policyCapabilities(
  actor: MemoryAccessContext,
  policy: AgentIdentityPolicy | undefined
): readonly AgentCapability[] | undefined {
  return policy?.allowedCapabilitiesByRole?.[actor.role] ?? policy?.allowedCapabilities;
}

function intersectGrants(
  allowed: readonly MemoryScopeGrant[],
  requested: readonly MemoryScopeGrant[]
): MemoryScopeGrant[] {
  const grants = requested.filter((requestedGrant) =>
    allowed.some(
      (allowedGrant) =>
        allowedGrant.scope === requestedGrant.scope &&
        allowedGrant.scopeId === requestedGrant.scopeId
    )
  );
  if (grants.length === 0) {
    throw new AgentIdentityError("scope_denied", "No token grants remain within the agent bounds");
  }
  return grants.map((grant) => ({ ...grant }));
}

function intersectCapabilities(
  allowed: readonly AgentCapability[],
  requested: readonly AgentCapability[]
): AgentCapability[] {
  const capabilities = requested.filter((capability) => allowed.includes(capability));
  if (capabilities.length === 0) {
    throw new AgentIdentityError(
      "capability_denied",
      "No token capabilities remain within the agent bounds"
    );
  }
  return [...new Set(capabilities)];
}

async function requireKeyById(
  store: AgentIdentityStore,
  keyId: string
): Promise<{ identity: AgentIdentity; key: AgentKey }> {
  const key = await store.getKey(keyId);
  if (!key) throw new AgentIdentityError("key_not_found", "Agent key not found");
  const identity = await store.getIdentity(key.agentIdentityId);
  if (!identity) {
    throw new AgentIdentityError("identity_not_found", "Agent identity not found");
  }
  return { identity, key };
}

function assertCapabilitiesWithin(
  allowed: readonly AgentCapability[],
  requested: readonly AgentCapability[]
): void {
  if (requested.some((capability) => !allowed.includes(capability))) {
    throw new AgentIdentityError(
      "capability_denied",
      "Requested capability is outside the agent bounds"
    );
  }
}

async function assertKeyUsable(
  store: AgentIdentityStore,
  identity: AgentIdentity,
  key: AgentKey,
  now: Date
): Promise<void> {
  if (identity.status !== "active" || key.status !== "active") {
    throw new AgentIdentityError("key_inactive", "Agent key is not active");
  }
  if (isPast(identity.expiresAt, now) || isPast(key.expiresAt, now)) {
    await expireKey(store, identity, key, now);
    throw new AgentIdentityError("key_expired", "Agent key expired");
  }
}

async function validateSponsorAccess(
  store: AgentIdentityStore,
  identity: AgentIdentity,
  key: AgentKey,
  sponsorValidator: AgentSponsorValidator | undefined,
  now: Date
): Promise<void> {
  if (!sponsorValidator) return;

  let result: AgentSponsorValidationResult;
  try {
    result = await sponsorValidator({ identity, key });
  } catch {
    throw new AgentIdentityError(
      "sponsor_revalidation_unavailable",
      "Sponsor access could not be revalidated",
      503
    );
  }

  if (result.valid) return;

  await disableForSponsorRevalidation(store, identity, key, result.reason, now);
  throw new AgentIdentityError(
    result.reason,
    "Sponsor access is no longer valid for this agent",
    403
  );
}

async function disableForSponsorRevalidation(
  store: AgentIdentityStore,
  identity: AgentIdentity,
  key: AgentKey,
  reason: string,
  now: Date
): Promise<void> {
  const disabledAt = now.toISOString();
  const actor = actorForIdentity(identity, key);
  await store.upsertKey({
    ...key,
    status: "disabled",
    revokedAt: disabledAt,
    revokedByActor: actor,
    revocationReason: reason,
    sessionVersion: key.sessionVersion + 1,
    updatedAt: disabledAt
  });
  await store.upsertIdentity({
    ...identity,
    status: "disabled",
    revokedAt: disabledAt,
    revokedByActor: actor,
    revocationReason: reason,
    updatedAt: disabledAt
  });
  await store.appendAuditEvent({
    id: createId("aae"),
    eventType: "agent.disabled",
    occurredAt: disabledAt,
    organizationId: identity.organizationId,
    sponsorSubjectId: identity.sponsorSubjectId,
    actorContext: actor,
    agentIdentityId: identity.id,
    agentKeyId: key.id,
    targetType: "agent_key",
    targetId: key.id,
    metadata: { reason, source: "sponsor_revalidation" }
  });
}

async function expireKey(
  store: AgentIdentityStore,
  identity: AgentIdentity,
  key: AgentKey,
  now: Date
): Promise<void> {
  const expiredAt = now.toISOString();
  const actor = actorForIdentity(identity, key);
  await store.upsertKey({
    ...key,
    status: "expired",
    updatedAt: expiredAt
  });
  await store.upsertIdentity({
    ...identity,
    status: "expired",
    updatedAt: expiredAt
  });
  await store.appendAuditEvent({
    id: createId("aae"),
    eventType: "agent.expired",
    occurredAt: expiredAt,
    organizationId: identity.organizationId,
    sponsorSubjectId: identity.sponsorSubjectId,
    actorContext: actor,
    agentIdentityId: identity.id,
    agentKeyId: key.id,
    targetType: "agent_key",
    targetId: key.id,
    metadata: { expiresAt: key.expiresAt }
  });
}

async function sendExpiryWarning(
  store: AgentIdentityStore,
  identity: AgentIdentity,
  key: AgentKey,
  daysBefore: number,
  now: Date
): Promise<void> {
  const sentAt = now.toISOString();
  const actor = actorForIdentity(identity, key);
  const expiryWarningsSent = [...(identity.expiryWarningsSent ?? []), { daysBefore, sentAt }];

  await store.upsertIdentity({
    ...identity,
    expiryWarningsSent,
    updatedAt: sentAt
  });
  await store.appendAuditEvent({
    id: createId("aae"),
    eventType: "agent.expiry_warning",
    occurredAt: sentAt,
    organizationId: identity.organizationId,
    sponsorSubjectId: identity.sponsorSubjectId,
    actorContext: actor,
    agentIdentityId: identity.id,
    agentKeyId: key.id,
    targetType: "agent_key",
    targetId: key.id,
    metadata: {
      daysBefore,
      expiresAt: key.expiresAt,
      notificationChannel: "audit_event"
    }
  });
}

function dueWarningDay(
  identity: AgentIdentity,
  now: Date,
  warningDays: readonly number[]
): number | null {
  const remainingDays = Math.ceil(
    (new Date(identity.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const currentThreshold = warningDays.find((daysBefore) => remainingDays <= daysBefore) ?? null;
  if (!currentThreshold) return null;

  const alreadySent = identity.expiryWarningsSent?.some(
    (warning) => warning.daysBefore === currentThreshold
  );
  return alreadySent ? null : currentThreshold;
}

function normalizeWarningDays(values: readonly number[]): number[] {
  return [...new Set(values)]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);
}

function maxNumber(values: readonly number[], fallback: number): number {
  return values.reduce((max, value) => Math.max(max, value), fallback);
}

function assertFuture(value: string, now: Date, message: string): void {
  if (isPast(value, now) || new Date(value).getTime() === now.getTime()) {
    throw new AgentIdentityError("invalid_expiration", message);
  }
}

function canViewIdentity(actor: MemoryAccessContext, identity: AgentIdentity): boolean {
  return (
    identity.organizationId === actor.organizationId &&
    (isAdmin(actor) || identity.sponsorSubjectId === toSponsorActorContext(actor).subjectId)
  );
}

function canMutateIdentity(actor: MemoryAccessContext, identity: AgentIdentity): boolean {
  return canViewIdentity(actor, identity);
}

function isAdmin(actor: MemoryAccessContext): boolean {
  return (
    actor.role === "admin" ||
    actor.role === "local-admin" ||
    actor.permissions.includes("agent:admin") ||
    actor.permissions.includes("admin")
  );
}

function assertAdmin(actor: MemoryAccessContext, message: string): void {
  if (!isAdmin(actor)) throw new AgentIdentityError("forbidden", message, 403);
}

function actorForIdentity(identity: AgentIdentity, key: AgentKey): ActorContext {
  return toAgentActorContext(
    {
      subjectId: identity.sponsorSubjectId,
      subjectType: "user",
      provider: identity.createdByActor.provider,
      displayName: identity.sponsorDisplayName,
      sessionId: identity.createdByActor.sessionId,
      organizationId: identity.organizationId,
      role: identity.createdByActor.sponsor.role,
      permissions: identity.createdByActor.sponsor.permissions,
      grants: identity.allowedScopes
    },
    identity,
    key,
    crypto.randomUUID()
  );
}

function toRuntimeActorContext(accessContext: MemoryAccessContext): ActorContext {
  return {
    actorType: accessContext.agent ? "agent" : "user",
    displayName: accessContext.displayName,
    provider: accessContext.provider,
    organizationId: accessContext.organizationId,
    sessionId: accessContext.sessionId,
    sponsor: accessContext.sponsor ?? {
      subjectId: accessContext.subjectId,
      displayName: accessContext.displayName,
      role: accessContext.role,
      permissions: accessContext.permissions
    },
    agent: accessContext.agent
      ? {
          ...accessContext.agent,
          status: toAgentIdentityStatus(accessContext.agent.status)
        }
      : undefined,
    grants: accessContext.grants.map((grant) => ({ ...grant }))
  };
}

function toAgentIdentityStatus(value: string): AgentIdentityStatus {
  if (value === "active" || value === "expired" || value === "revoked" || value === "disabled") {
    return value;
  }
  return "active";
}

function implicitOAuthClient(
  actor: MemoryAccessContext,
  clientId: string
): AgentOAuthClient | null {
  const local = actor.provider === "local";
  if (!local) return null;

  const timestamp = new Date(0).toISOString();
  const actorContext = toUserActorContext(actor);
  return {
    id: clientId,
    organizationId: actor.organizationId,
    name: clientId,
    status: "active",
    redirectUris: [],
    allowedCapabilities: requestedCapabilities(actor, undefined),
    allowLocalRedirects: local,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByActor: actorContext
  };
}

function normalizeRedirectUris(values: readonly string[]): string[] {
  const redirectUris = values.map(normalizeRedirectUri).filter(isNonEmpty);
  return [...new Set(redirectUris)];
}

function normalizeRedirectUri(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function isOAuthRedirectAllowed(client: AgentOAuthClient, value: string): boolean {
  const redirectUri = normalizeRedirectUri(value);
  if (!redirectUri) return false;

  return (
    client.redirectUris.includes(redirectUri) ||
    (client.allowLocalRedirects && isLocalRedirect(new URL(redirectUri)))
  );
}

function isLocalRedirect(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  );
}

function isNonEmpty(value: string): boolean {
  return value.length > 0;
}

function isPast(value: string, now: Date): boolean {
  return new Date(value).getTime() < now.getTime();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function errorStatus(code: string): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "key_not_found":
    case "identity_not_found":
      return 404;
    case "agent_identity_error":
      return 500;
    default:
      return 400;
  }
}
