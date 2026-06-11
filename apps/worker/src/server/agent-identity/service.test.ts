import { describe, expect, test } from "bun:test";

import { createAuthIdentityAdapter } from "../auth/identity";
import { createLocalMemoryAccessContext } from "../memory/access";
import { createAgentIdentityService } from "./client";
import { AgentIdentityService, resolveAccessTokenClaims } from "./service";
import { InMemoryAgentIdentityStore } from "./store";
import { hashToken, pkceChallenge, verifyAgentAccessToken } from "./tokens";

const tokenSecret = "agent-identity-test-secret-agent-identity-test-secret";

describe("AgentIdentityService", () => {
  test("creates sponsor-bound OBOU identities with expiring public keys", async () => {
    const service = newTestService();
    const actor = createLocalMemoryAccessContext();
    const expiresAt = new Date("2026-07-10T00:00:00.000Z").toISOString();

    const result = await service.createIdentity({
      actor,
      name: "Codex",
      allowedCapabilities: ["memory:read", "memory:write"],
      expiresAt,
      now: new Date("2026-06-10T00:00:00.000Z")
    });

    expect(result.identity).toMatchObject({
      name: "Codex",
      actingMode: "obou",
      sponsorSubjectId: "local-user",
      organizationId: "default-org",
      status: "active",
      expiresAt
    });
    expect(result.key.id).toStartWith("ak_");
    expect(result.key.status).toBe("active");
    expect(result.key.expiresAt).toBe(expiresAt);
  });

  test("rejects standalone agents and scopes outside the sponsor grants", async () => {
    const service = newTestService();
    const actor = createLocalMemoryAccessContext();

    await expect(
      service.createIdentity({
        actor,
        name: "Standalone",
        actingMode: "standalone"
      })
    ).rejects.toMatchObject({ code: "standalone_not_enabled" });

    await expect(
      service.createIdentity({
        actor,
        name: "Wrong org",
        allowedScopes: [{ scope: "org", scopeId: "other-org" }]
      })
    ).rejects.toMatchObject({ code: "scope_denied" });
  });

  test("exchanges S256 authorization codes once and resolves agent actor context", async () => {
    const service = createAgentIdentityService({
      AGENT_ACCESS_TOKEN_SECRET: tokenSecret
    });
    const actor = createLocalMemoryAccessContext();
    const verifier = "valid-code-verifier-valid-code-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentName: "Codex",
      clientId: "teampitch-cli",
      redirectUri: "http://127.0.0.1:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read", "routing:write"]
    });

    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://127.0.0.1:8787/callback",
      codeVerifier: verifier
    });

    const claims = await verifyAgentAccessToken(exchange.tokens.accessToken, tokenSecret);
    expect(claims.agent.name).toBe("Codex");
    expect(claims.sponsor.subjectId).toBe("local-user");
    expect(claims.capabilities).toEqual(["memory:read", "routing:write"]);

    const adapter = createAuthIdentityAdapter({
      AUTH_IDENTITY_ADAPTER: "workos",
      AGENT_ACCESS_TOKEN_SECRET: tokenSecret
    });
    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        AGENT_ACCESS_TOKEN_SECRET: tokenSecret
      },
      request: new Request("https://assistant.test/agents/think/default", {
        headers: { authorization: `Bearer ${exchange.tokens.accessToken}` }
      })
    });

    expect(identity).toMatchObject({
      subjectType: "agent",
      subjectId: authorization.identity.id,
      displayName: "Local User via Codex",
      provider: "workos"
    });
    expect(identity.permissions).toEqual(["memory:read", "routing:write"]);
    expect(identity.agent?.keyId).toBe(authorization.key.id);
    expect(identity.sponsor?.subjectId).toBe("local-user");

    await expect(
      service.exchangeAuthorizationCode({
        code: authorization.code,
        redirectUri: "http://127.0.0.1:8787/callback",
        codeVerifier: verifier
      })
    ).rejects.toMatchObject({ code: "code_used" });
  });

  test("rejects invalid PKCE and refresh after key revocation", async () => {
    const service = newTestService();
    const actor = createLocalMemoryAccessContext();
    const verifier = "another-valid-code-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentName: "Claude",
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"]
    });

    await expect(
      service.exchangeAuthorizationCode({
        code: authorization.code,
        redirectUri: "http://localhost:8787/callback",
        codeVerifier: "wrong-verifier"
      })
    ).rejects.toMatchObject({ code: "invalid_pkce_verifier" });

    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: verifier
    });

    await service.revokeIdentity({
      actor,
      keyId: authorization.identity.id,
      reason: "test cleanup"
    });

    await expect(
      service.refresh({ refreshToken: exchange.tokens.refreshToken })
    ).rejects.toMatchObject({ code: "key_inactive" });
  });

  test("records runtime action audit events for agent actors", async () => {
    const store = new InMemoryAgentIdentityStore();
    const service = new AgentIdentityService(store, {
      accessTokenSecret: tokenSecret
    });
    const actor = createLocalMemoryAccessContext();
    const verifier = "runtime-action-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentName: "Runtime Agent",
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"]
    });
    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: verifier
    });
    const agentActor = await resolveAccessTokenClaims(
      store,
      await verifyAgentAccessToken(exchange.tokens.accessToken, tokenSecret)
    );

    await service.recordRuntimeAction({
      actor: agentActor,
      targetType: "memory_tool",
      targetId: "searchMemory",
      metadata: { capability: "memory:read" }
    });

    const events = await service.listAuditEvents(actor, authorization.identity.id);
    expect(events).toContainEqual(
      expect.objectContaining({
        eventType: "agent.runtime_action",
        targetType: "memory_tool",
        targetId: "searchMemory"
      })
    );
  });

  test("stores hashed authorization codes instead of raw codes", async () => {
    const store = new InMemoryAgentIdentityStore();
    const service = new AgentIdentityService(store, {
      accessTokenSecret: tokenSecret
    });
    const actor = createLocalMemoryAccessContext();
    const verifier = "hash-code-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"]
    });

    expect(await store.getAuthorizationCode(authorization.code)).toBeNull();
    expect(await store.getAuthorizationCode(await hashToken(authorization.code))).not.toBeNull();
  });

  test("exposes sponsor management and audit methods directly", async () => {
    const service = newTestService();
    const actor = createLocalMemoryAccessContext();
    const verifier = "management-code-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentName: "Management Agent",
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"]
    });
    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: verifier
    });

    expect(await service.listIdentities(actor)).toHaveLength(1);
    expect(await service.getIdentityForActor(actor, authorization.identity.id)).toMatchObject({
      name: "Management Agent"
    });

    await service.renewIdentity({
      actor,
      keyId: authorization.identity.id,
      expiresAt: "2026-08-10T00:00:00.000Z",
      now: new Date("2026-06-10T00:00:00.000Z")
    });
    await service.revokeRefreshToken({
      refreshToken: exchange.tokens.refreshToken,
      reason: "test revoke"
    });

    const events = await service.listAuditEvents(actor, authorization.identity.id);
    expect(events.map((event) => event.eventType)).toContain("agent.renewed");
  });

  test("enforces admin override and non-admin sponsor isolation", async () => {
    const service = newTestService();
    const sponsor = testActor("user-a", "member", ["memory:read"]);
    const otherSponsor = testActor("user-b", "member", ["memory:read"]);
    const admin = testActor("admin-user", "admin", ["admin", "memory:read"]);
    const created = await service.createIdentity({
      actor: sponsor,
      name: "Scoped Agent",
      allowedCapabilities: ["memory:read"]
    });

    expect(await service.getIdentityForActor(otherSponsor, created.identity.id)).toBeNull();
    await expect(
      service.revokeIdentity({
        actor: otherSponsor,
        keyId: created.identity.id,
        reason: "not owner"
      })
    ).rejects.toMatchObject({ code: "forbidden" });

    expect(
      await service.listIdentities(admin, {
        includeAllSponsors: true,
        sponsorSubjectId: "user-a",
        status: "active",
        scope: "private"
      })
    ).toHaveLength(1);

    const disabled = await service.disableIdentity({
      actor: admin,
      keyId: created.identity.id,
      reason: "policy"
    });
    expect(disabled.status).toBe("disabled");
    const events = await service.listAuditEvents(admin, created.identity.id);
    expect(events.map((event) => event.eventType)).toContain("agent.disabled");
  });

  test("enforces creation and capability policy", async () => {
    const actor = createLocalMemoryAccessContext();
    await expect(
      new AgentIdentityService(new InMemoryAgentIdentityStore(), {
        accessTokenSecret: tokenSecret,
        policy: { creationDisabled: true }
      }).createIdentity({
        actor,
        name: "Blocked"
      })
    ).rejects.toMatchObject({ code: "agent_creation_disabled" });

    await expect(
      new AgentIdentityService(new InMemoryAgentIdentityStore(), {
        accessTokenSecret: tokenSecret,
        policy: { maxExpiryDays: 7 }
      }).createIdentity({
        actor,
        name: "Too Long",
        expiresAt: "2026-07-10T00:00:00.000Z",
        now: new Date("2026-06-10T00:00:00.000Z")
      })
    ).rejects.toMatchObject({ code: "max_expiry_exceeded" });

    const service = new AgentIdentityService(new InMemoryAgentIdentityStore(), {
      accessTokenSecret: tokenSecret,
      policy: { allowedCapabilities: ["memory:read"] }
    });
    const created = await service.createIdentity({
      actor,
      name: "Read Only",
      allowedCapabilities: ["memory:read", "memory:write"]
    });
    expect(created.identity.allowedCapabilities).toEqual(["memory:read"]);
  });

  test("expires active keys with durable audit history", async () => {
    const service = newTestService();
    const actor = createLocalMemoryAccessContext();
    const created = await service.createIdentity({
      actor,
      name: "Expiring Agent",
      expiresAt: "2026-06-11T00:00:00.000Z",
      now: new Date("2026-06-10T00:00:00.000Z")
    });

    await expect(
      service.createAuthorizationCode({
        actor,
        agentKeyId: created.key.id,
        clientId: "teampitch-cli",
        redirectUri: "http://localhost:8787/callback",
        codeChallenge: await pkceChallenge("expired-key-verifier"),
        codeChallengeMethod: "S256",
        requestedScopes: ["memory:read"],
        now: new Date("2026-06-12T00:00:00.000Z")
      })
    ).rejects.toMatchObject({ code: "key_expired" });

    expect(await service.getIdentityForActor(actor, created.identity.id)).toMatchObject({
      status: "expired"
    });
    const events = await service.listAuditEvents(actor, created.identity.id);
    expect(events.map((event) => event.eventType)).toContain("agent.expired");
  });

  test("rejects non-local redirects without registration and enforces redirect policy", async () => {
    const actor = createLocalMemoryAccessContext();
    const verifier = "redirect-policy-verifier";
    const service = newTestService();

    await expect(
      service.createAuthorizationCode({
        actor,
        clientId: "teampitch-cli",
        redirectUri: "https://example.com/callback",
        codeChallenge: await pkceChallenge(verifier),
        codeChallengeMethod: "S256",
        requestedScopes: ["memory:read"]
      })
    ).rejects.toMatchObject({ code: "invalid_redirect_uri" });

    const allowlisted = new AgentIdentityService(new InMemoryAgentIdentityStore(), {
      accessTokenSecret: tokenSecret,
      policy: { allowedRedirectUris: ["https://example.com/callback"] }
    });
    await expect(
      allowlisted.createOAuthClient({
        actor,
        clientId: "bad-redirect-client",
        name: "Bad Redirect Client",
        redirectUris: ["https://not-allowed.example/callback"],
        allowedCapabilities: ["memory:read"]
      })
    ).rejects.toMatchObject({ code: "invalid_redirect_uri" });

    await allowlisted.createOAuthClient({
      actor,
      clientId: "allowlisted-client",
      name: "Allowlisted Client",
      redirectUris: ["https://example.com/callback"],
      allowedCapabilities: ["memory:read"]
    });
    await expect(
      allowlisted.createAuthorizationCode({
        actor,
        clientId: "allowlisted-client",
        redirectUri: "https://example.com/callback",
        codeChallenge: await pkceChallenge(verifier),
        codeChallengeMethod: "S256",
        requestedScopes: ["memory:read"]
      })
    ).resolves.toMatchObject({ redirectUri: "https://example.com/callback" });
  });

  test("uses registered OAuth clients for non-local redirects and client bounds", async () => {
    const service = newTestService();
    const actor = createLocalMemoryAccessContext();
    const verifier = "registered-client-verifier";

    await service.createOAuthClient({
      actor,
      clientId: "registered-cli",
      name: "Registered CLI",
      redirectUris: ["https://client.example/callback"],
      allowedCapabilities: ["memory:read"]
    });

    const authorization = await service.createAuthorizationCode({
      actor,
      clientId: "registered-cli",
      redirectUri: "https://client.example/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read", "memory:write"]
    });

    expect(authorization.identity.allowedCapabilities).toEqual(["memory:read"]);

    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "https://client.example/callback",
      codeVerifier: verifier
    });
    expect(exchange.capabilities).toEqual(["memory:read"]);

    const disabled = await service.disableOAuthClient({
      actor,
      clientId: "registered-cli",
      reason: "test disabled"
    });
    expect(disabled.status).toBe("disabled");

    await expect(
      service.createAuthorizationCode({
        actor,
        clientId: "registered-cli",
        redirectUri: "https://client.example/callback",
        codeChallenge: await pkceChallenge("disabled-client-verifier"),
        codeChallengeMethod: "S256",
        requestedScopes: ["memory:read"]
      })
    ).rejects.toMatchObject({ code: "oauth_client_disabled" });
  });

  test("disables OBOU agents when sponsor revalidation fails", async () => {
    const store = new InMemoryAgentIdentityStore();
    let sponsorValid = true;
    const service = new AgentIdentityService(store, {
      accessTokenSecret: tokenSecret,
      sponsorValidator: async () =>
        sponsorValid ? { valid: true } : { valid: false, reason: "sponsor_org_membership_inactive" }
    });
    const actor = createLocalMemoryAccessContext();
    const verifier = "sponsor-revalidation-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentName: "Sponsor Bound Agent",
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"]
    });

    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: verifier
    });

    sponsorValid = false;
    await expect(
      service.refresh({ refreshToken: exchange.tokens.refreshToken })
    ).rejects.toMatchObject({ code: "sponsor_org_membership_inactive" });

    await expect(store.getIdentity(authorization.identity.id)).resolves.toMatchObject({
      status: "disabled",
      revocationReason: "sponsor_org_membership_inactive"
    });
    await expect(store.getKey(authorization.key.id)).resolves.toMatchObject({
      status: "disabled",
      sessionVersion: 2
    });
    const events = await store.listAuditEvents({
      organizationId: authorization.identity.organizationId,
      agentIdentityId: authorization.identity.id
    });
    expect(events.map((event) => event.eventType)).toContain("agent.disabled");
  });

  test("fails closed without disabling when sponsor revalidation is unavailable", async () => {
    const store = new InMemoryAgentIdentityStore();
    const service = new AgentIdentityService(store, {
      accessTokenSecret: tokenSecret
    });
    const actor = createLocalMemoryAccessContext();
    const verifier = "sponsor-unavailable-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentName: "Transient Validator Agent",
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"]
    });
    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: verifier
    });
    const claims = await verifyAgentAccessToken(exchange.tokens.accessToken, tokenSecret);

    await expect(
      resolveAccessTokenClaims(store, claims, undefined, async () => {
        throw new Error("workos unavailable");
      })
    ).rejects.toMatchObject({ code: "sponsor_revalidation_unavailable" });

    await expect(store.getIdentity(authorization.identity.id)).resolves.toMatchObject({
      status: "active"
    });
  });

  test("runs lifecycle maintenance for expiry warnings and expirations", async () => {
    const store = new InMemoryAgentIdentityStore();
    const service = new AgentIdentityService(store, {
      accessTokenSecret: tokenSecret
    });
    const actor = createLocalMemoryAccessContext();
    const warningTarget = await service.createIdentity({
      actor,
      name: "Warning Agent",
      expiresAt: "2026-06-24T00:00:00.000Z",
      now: new Date("2026-06-10T00:00:00.000Z")
    });
    const expiredTarget = await service.createIdentity({
      actor,
      name: "Expired Agent",
      expiresAt: "2026-06-11T00:00:00.000Z",
      now: new Date("2026-06-10T00:00:00.000Z")
    });
    const sessionCleanupTarget = await service.createIdentity({
      actor,
      name: "Session Cleanup Agent",
      expiresAt: "2026-12-31T00:00:00.000Z",
      now: new Date("2026-01-01T00:00:00.000Z")
    });
    const verifier = "expired-refresh-session-verifier";
    const authorization = await service.createAuthorizationCode({
      actor,
      agentKeyId: sessionCleanupTarget.key.id,
      clientId: "teampitch-cli",
      redirectUri: "http://localhost:8787/callback",
      codeChallenge: await pkceChallenge(verifier),
      codeChallengeMethod: "S256",
      requestedScopes: ["memory:read"],
      now: new Date("2026-01-01T00:00:00.000Z")
    });
    const exchange = await service.exchangeAuthorizationCode({
      code: authorization.code,
      redirectUri: "http://localhost:8787/callback",
      codeVerifier: verifier,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    const result = await service.runLifecycleMaintenance({
      now: new Date("2026-06-12T00:00:00.000Z")
    });

    expect(result).toMatchObject({
      checked: 2,
      expired: 1,
      expiryWarningsSent: 1,
      expiredRefreshSessionsRevoked: 1
    });
    await expect(store.getIdentity(warningTarget.identity.id)).resolves.toMatchObject({
      status: "active",
      expiryWarningsSent: [{ daysBefore: 14 }]
    });
    await expect(store.getIdentity(expiredTarget.identity.id)).resolves.toMatchObject({
      status: "expired"
    });
    await expect(
      store.getRefreshSession(await hashToken(exchange.tokens.refreshToken))
    ).resolves.toMatchObject({
      revokedAt: "2026-06-12T00:00:00.000Z",
      revocationReason: "expired_cleanup"
    });

    const events = await store.listAuditEvents({
      organizationId: actor.organizationId
    });
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["agent.expiry_warning", "agent.expired"])
    );
  });
});

function newTestService(): AgentIdentityService {
  return new AgentIdentityService(new InMemoryAgentIdentityStore(), {
    accessTokenSecret: tokenSecret
  });
}

function testActor(subjectId: string, role: string, permissions: readonly string[]) {
  const base = createLocalMemoryAccessContext();
  return {
    ...base,
    subjectId,
    displayName: subjectId,
    role,
    permissions,
    grants: [
      { scope: "private" as const, scopeId: subjectId },
      { scope: "org" as const, scopeId: base.organizationId }
    ]
  };
}
