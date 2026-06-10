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
    const response = await handleAuthRequest(
      new Request("https://assistant.test/auth/me"),
      {}
    );

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
    const response = await handleAuthRequest(
      new Request("https://assistant.test/auth/login"),
      { AUTH_IDENTITY_ADAPTER: "workos" }
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    const body = (await response!.json()) as { error: string };
    expect(body).toEqual({ error: "workos_not_configured" });
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
