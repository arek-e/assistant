import { describe, expect, test } from "bun:test";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import {
  createAuthIdentityAdapter,
  createWorkOSMemoryAccessContext,
  WorkOSAuthIdentityAdapter
} from "./identity";

describe("auth identity adapters", () => {
  test("uses the local fallback without WorkOS configuration", async () => {
    const adapter = createAuthIdentityAdapter({});
    const identity = await adapter.resolve({
      env: {},
      sessionId: "session-test"
    });

    expect(identity.provider).toBe("local");
    expect(identity.subjectId).toBe("local-user");
    expect(identity.subjectType).toBe("user");
    expect(identity.grants).toContainEqual({
      scope: "session",
      scopeId: "session-test"
    });
  });

  test("builds grants from mocked WorkOS claims", async () => {
    const adapter = new WorkOSAuthIdentityAdapter(async (token, config) => {
      expect(token).toBe("mock-token");
      expect(config.clientId).toBe("client_123");
      expect(config.issuer).toBe("https://api.workos.com");

      return {
        sub: "user_123",
        sid: "session_123",
        org_id: "org_123",
        team_ids: ["team_1", "team_2"],
        role: "admin",
        permissions: ["memory:read", "memory:write"],
        email: "sarah@example.com"
      };
    });

    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: "client_123"
      },
      request: new Request("https://assistant.test", {
        headers: { authorization: "Bearer mock-token" }
      })
    });

    expect(identity).toMatchObject({
      provider: "workos",
      subjectId: "user_123",
      sessionId: "session_123",
      organizationId: "org_123",
      role: "admin",
      displayName: "sarah@example.com"
    });
    expect(identity.grants).toEqual([
      { scope: "private", scopeId: "user_123" },
      { scope: "session", scopeId: "session_123" },
      { scope: "team", scopeId: "team_1" },
      { scope: "team", scopeId: "team_2" },
      { scope: "org", scopeId: "org_123" }
    ]);
  });

  test("uses configured issuer when verifying WorkOS access tokens", async () => {
    const adapter = new WorkOSAuthIdentityAdapter(async (_token, config) => {
      expect(config).toMatchObject({
        clientId: "client_123",
        issuer: "https://auth.example.test",
        jwksUrl: "https://jwks.example.test"
      });

      return {
        sub: "user_issuer",
        sid: "session_issuer"
      };
    });

    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: "client_123",
        WORKOS_ISSUER: "https://auth.example.test",
        WORKOS_JWKS_URL: "https://jwks.example.test"
      },
      request: new Request("https://assistant.test", {
        headers: { authorization: "Bearer mock-token" }
      })
    });

    expect(identity.provider).toBe("workos");
    expect(identity.subjectId).toBe("user_issuer");
  });

  test("falls back to the sealed session when token verification fails", async () => {
    const adapter = new WorkOSAuthIdentityAdapter(
      async () => {
        throw new Error("invalid token");
      },
      async () => ({
        authenticated: true,
        session: {
          accessToken: "session-access-token",
          sessionId: "session_from_cookie",
          organizationId: "org_from_cookie",
          role: "member",
          permissions: ["memory:read"],
          user: {
            id: "user_from_cookie",
            email: "cookie@example.com",
            firstName: "Cookie",
            lastName: "User"
          } as never
        }
      })
    );

    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: "client_123"
      },
      request: new Request("https://assistant.test", {
        headers: {
          authorization: "Bearer invalid-token",
          cookie: "wos-session=sealed-session"
        }
      })
    });

    expect(identity).toMatchObject({
      provider: "workos",
      subjectId: "user_from_cookie",
      sessionId: "session_from_cookie",
      organizationId: "org_from_cookie",
      displayName: "Cookie User"
    });
  });

  test("ignores query tokens unless the query parameter is explicitly configured", async () => {
    const adapter = new WorkOSAuthIdentityAdapter(async () => {
      throw new Error("query token should not be verified");
    });

    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: "client_123"
      },
      request: new Request("https://assistant.test?access_token=query-token&token=query-token"),
      sessionId: "session-anonymous"
    });

    expect(identity.provider).toBe("anonymous");
    expect(identity.grants).toEqual([{ scope: "session", scopeId: "session-anonymous" }]);
  });

  test("supports explicit query token configuration for non-browser adapters", async () => {
    const adapter = new WorkOSAuthIdentityAdapter(async (token) => {
      expect(token).toBe("configured-query-token");
      return {
        sub: "user_query",
        sid: "session_query"
      };
    });

    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: "client_123",
        WORKOS_ACCESS_TOKEN_QUERY_PARAM: "workos_token"
      },
      request: new Request("https://assistant.test?workos_token=configured-query-token")
    });

    expect(identity.provider).toBe("workos");
    expect(identity.subjectId).toBe("user_query");
  });

  test("prefers the sealed session over a configured query token", async () => {
    const adapter = new WorkOSAuthIdentityAdapter(
      async () => {
        throw new Error("query token should not override the sealed session");
      },
      async () => ({
        authenticated: true,
        session: {
          accessToken: "session-access-token",
          sessionId: "session_from_cookie",
          organizationId: "org_from_cookie",
          user: {
            id: "user_from_cookie",
            email: "cookie@example.com"
          } as never
        }
      })
    );

    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: "client_123",
        WORKOS_ACCESS_TOKEN_QUERY_PARAM: "workos_token"
      },
      request: new Request("https://assistant.test?workos_token=configured-query-token", {
        headers: { cookie: "wos-session=sealed-session" }
      })
    });

    expect(identity.provider).toBe("workos");
    expect(identity.subjectId).toBe("user_from_cookie");
    expect(identity.sessionId).toBe("session_from_cookie");
  });

  test("rejects signed WorkOS tokens for the wrong audience", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }]
        });
      }
    });

    const token = await new SignJWT({
      sub: "user_wrong_audience",
      sid: "session_wrong_audience"
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://api.workos.com")
      .setAudience("different-client")
      .setExpirationTime("5m")
      .sign(privateKey);

    try {
      const adapter = new WorkOSAuthIdentityAdapter();
      const identity = await adapter.resolve({
        env: {
          AUTH_IDENTITY_ADAPTER: "workos",
          WORKOS_CLIENT_ID: "client_123",
          WORKOS_JWKS_URL: `http://127.0.0.1:${server.port}/jwks`
        },
        request: new Request("https://assistant.test", {
          headers: { authorization: `Bearer ${token}` }
        }),
        sessionId: "session-anonymous"
      });

      expect(identity.provider).toBe("anonymous");
      expect(identity.grants).toEqual([{ scope: "session", scopeId: "session-anonymous" }]);
    } finally {
      await server.stop();
    }
  });

  test("falls closed to a session-only actor without a WorkOS token", async () => {
    const adapter = createAuthIdentityAdapter({
      AUTH_IDENTITY_ADAPTER: "workos"
    });
    const identity = await adapter.resolve({
      env: { AUTH_IDENTITY_ADAPTER: "workos" },
      sessionId: "session-anonymous"
    });

    expect(identity.provider).toBe("anonymous");
    expect(identity.grants).toEqual([{ scope: "session", scopeId: "session-anonymous" }]);
  });

  test("resolves demo users as WorkOS-shaped identities only in safe demo contexts", async () => {
    const adapter = createAuthIdentityAdapter({
      AUTH_IDENTITY_ADAPTER: "workos"
    });
    const demoEnv = {
      AUTH_IDENTITY_ADAPTER: "workos",
      AUTH_DEMO_USERS_ENABLED: "1"
    };

    const identity = await adapter.resolve({
      env: demoEnv,
      request: new Request("http://localhost:5174", {
        headers: { cookie: "tp-demo-user=member" }
      })
    });

    expect(identity).toMatchObject({
      provider: "workos",
      subjectId: "demo-member",
      sessionId: "demo-session-member",
      organizationId: "demo-org",
      role: "member",
      displayName: "Demo Member"
    });
    expect(identity.permissions).not.toContain("agent:admin");
    expect(identity.grants).toContainEqual({
      scope: "team",
      scopeId: "demo-finance-team"
    });

    const productionIdentity = await adapter.resolve({
      env: demoEnv,
      request: new Request("https://assistant.example.com", {
        headers: { cookie: "tp-demo-user=member" }
      }),
      sessionId: "anonymous-production"
    });

    expect(productionIdentity.provider).toBe("anonymous");
    expect(productionIdentity.sessionId).toBe("anonymous-production");
  });

  test("can verify a real WorkOS token when E2E env vars are present", async () => {
    const token = process.env.WORKOS_E2E_ACCESS_TOKEN;
    const clientId = process.env.WORKOS_CLIENT_ID;

    if (!token || !clientId) {
      expect(true).toBe(true);
      return;
    }

    const adapter = new WorkOSAuthIdentityAdapter();
    const identity = await adapter.resolve({
      env: {
        AUTH_IDENTITY_ADAPTER: "workos",
        WORKOS_CLIENT_ID: clientId
      },
      request: new Request("https://assistant.test", {
        headers: { authorization: `Bearer ${token}` }
      })
    });

    expect(identity.provider).toBe("workos");
    expect(identity.subjectId).not.toBe("anonymous");
  });

  test("creates a WorkOS context directly from claims", () => {
    const identity = createWorkOSMemoryAccessContext(
      {
        sub: "user_456",
        org_id: "org_456",
        groups: ["group_456"]
      },
      "session_456"
    );

    expect(identity.grants).toContainEqual({
      scope: "team",
      scopeId: "group_456"
    });
  });
});
