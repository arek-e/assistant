import { describe, expect, test } from "bun:test";

import { handleAuthRequest, requireAuthenticatedAgentRequest } from "./routes";

const configuredWorkOSEnv = {
  AUTH_IDENTITY_ADAPTER: "workos",
  WORKOS_API_KEY: "fixture-api-key",
  WORKOS_CLIENT_ID: "client_123",
  WORKOS_COOKIE_PASSWORD: "01234567890123456789012345678901"
};

describe("auth routes", () => {
  test("auth/me returns local identity when WorkOS mode is not enabled", async () => {
    const response = await handleAuthRequest(new Request("https://assistant.test/auth/me"), {});

    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const body = (await response!.json()) as {
      authenticated: boolean;
      configured: boolean;
      provider: string;
      identity: { subjectId: string };
    };
    expect(body).toMatchObject({
      authenticated: true,
      configured: false,
      provider: "local"
    });
    expect(body.identity.subjectId).toBe("local-user");
  });

  test("auth/login reports missing WorkOS configuration", async () => {
    const response = await handleAuthRequest(new Request("https://assistant.test/auth/login"), {
      AUTH_IDENTITY_ADAPTER: "workos"
    });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    const body = (await response!.json()) as { error: string };
    expect(body).toEqual({ error: "workos_not_configured" });
  });

  test("auth/me exposes demo users only on localhost or staging-like environments", async () => {
    const localhostResponse = await handleAuthRequest(
      new Request("http://localhost:5174/auth/me"),
      { ...configuredWorkOSEnv, AUTH_DEMO_USERS_ENABLED: "1" }
    );
    const localhostBody = (await localhostResponse!.json()) as {
      demoUsers: readonly { id: string }[];
    };
    expect(localhostBody.demoUsers.map((user) => user.id)).toEqual(["admin", "member"]);

    const productionResponse = await handleAuthRequest(
      new Request("https://assistant.example.com/auth/me"),
      { ...configuredWorkOSEnv, AUTH_DEMO_USERS_ENABLED: "1" }
    );
    const productionBody = (await productionResponse!.json()) as {
      demoUsers?: readonly { id: string }[];
    };
    expect(productionBody.demoUsers).toEqual([]);

    const stagingResponse = await handleAuthRequest(
      new Request("https://staging.assistant.example.com/auth/me"),
      {
        ...configuredWorkOSEnv,
        AUTH_DEMO_USERS_ENABLED: "1",
        AUTH_DEMO_ENVIRONMENT: "staging"
      }
    );
    const stagingBody = (await stagingResponse!.json()) as {
      demoUsers: readonly { id: string }[];
    };
    expect(stagingBody.demoUsers.map((user) => user.id)).toEqual(["admin", "member"]);
  });

  test("auth/demo creates a WorkOS-shaped localhost demo session", async () => {
    const env = { ...configuredWorkOSEnv, AUTH_DEMO_USERS_ENABLED: "1" };
    const loginResponse = await handleAuthRequest(
      new Request("http://localhost:5174/auth/demo?user=admin&returnTo=/", {
        method: "POST"
      }),
      env
    );

    expect(loginResponse).not.toBeNull();
    expect(loginResponse?.status).toBe(303);
    expect(loginResponse?.headers.get("location")).toBe("/");
    expect(loginResponse?.headers.get("set-cookie")).toContain("tp-demo-user=admin");

    const meResponse = await handleAuthRequest(
      new Request("http://localhost:5174/auth/me", {
        headers: { cookie: "tp-demo-user=admin" }
      }),
      env
    );
    const body = (await meResponse!.json()) as {
      authenticated: boolean;
      provider: string;
      user: { email: string };
      identity: {
        role: string;
        permissions: readonly string[];
        grants: readonly { scope: string; scopeId: string }[];
      };
    };

    expect(body.authenticated).toBe(true);
    expect(body.provider).toBe("workos");
    expect(body.user.email).toBe("admin@teampitch.dev");
    expect(body.identity.role).toBe("admin");
    expect(body.identity.permissions).toContain("agent:admin");
    expect(body.identity.grants).toContainEqual({
      scope: "org",
      scopeId: "demo-org"
    });
  });

  test("auth/demo is blocked on production-like hosts even when the flag is enabled", async () => {
    const response = await handleAuthRequest(
      new Request("https://assistant.example.com/auth/demo?user=admin", {
        method: "POST"
      }),
      { ...configuredWorkOSEnv, AUTH_DEMO_USERS_ENABLED: "1" }
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
    const body = (await response!.json()) as { error: string };
    expect(body).toEqual({ error: "demo_auth_disabled" });
  });

  test("agent requests remain open in local mode", async () => {
    const response = await requireAuthenticatedAgentRequest(
      new Request("https://assistant.test/agents/think-agent/default"),
      {}
    );

    expect(response).toBeNull();
  });

  test("agent requests fail closed in WorkOS mode without a session", async () => {
    const response = await requireAuthenticatedAgentRequest(
      new Request("https://assistant.test/agents/think-agent/default"),
      configuredWorkOSEnv
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    const body = (await response!.json()) as { error: string };
    expect(body).toEqual({
      error: "authentication_required"
    });
  });
});
