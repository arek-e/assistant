import { describe, expect, test } from "bun:test";

import { handleAgentIdentityRequest } from "./routes";

describe("agent identity routes", () => {
  test("creates and lists local sponsor agent identities", async () => {
    const createResponse = await handleAgentIdentityRequest(
      new Request("https://assistant.test/api/agent-identities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Codex",
          allowedCapabilities: ["memory:read"],
          expiresAt: "2026-07-10T00:00:00.000Z"
        })
      }),
      {}
    );

    expect(createResponse?.status).toBe(201);
    const created = (await createResponse!.json()) as {
      identity: { id: string; name: string };
      key: { id: string };
    };
    expect(created.identity.name).toBe("Codex");

    const listResponse = await handleAgentIdentityRequest(
      new Request("https://assistant.test/api/agent-identities"),
      {}
    );
    expect(listResponse?.status).toBe(200);
    const identities = (await listResponse!.json()) as Array<{
      id: string;
      name: string;
    }>;
    expect(identities.map((identity) => identity.id)).toContain(created.identity.id);
  });

  test("rejects plain PKCE authorize requests", async () => {
    const response = await handleAgentIdentityRequest(
      new Request(
        "https://assistant.test/oauth/authorize?client_id=cli&redirect_uri=http://localhost:8787/callback&code_challenge=abc&code_challenge_method=plain&state=test-state"
      ),
      {}
    );

    expect(response?.status).toBe(400);
    const body = (await response!.json()) as { error: string };
    expect(body.error).toBe("invalid_pkce_method");
  });

  test("creates, lists, and disables registered OAuth clients", async () => {
    const clientId = `route-client-${crypto.randomUUID()}`;
    const createResponse = await handleAgentIdentityRequest(
      new Request("https://assistant.test/api/agent-oauth-clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          name: "Route Client",
          redirectUris: ["https://route-client.example/callback"],
          allowedCapabilities: ["memory:read"]
        })
      }),
      {}
    );

    expect(createResponse?.status).toBe(201);
    await expect(createResponse!.json()).resolves.toMatchObject({
      id: clientId,
      status: "active"
    });

    const listResponse = await handleAgentIdentityRequest(
      new Request("https://assistant.test/api/agent-oauth-clients"),
      {}
    );
    expect(listResponse?.status).toBe(200);
    const clients = (await listResponse!.json()) as Array<{ id: string }>;
    expect(clients.map((client) => client.id)).toContain(clientId);

    const disableResponse = await handleAgentIdentityRequest(
      new Request(`https://assistant.test/api/agent-oauth-clients/${clientId}/disable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "route test" })
      }),
      {}
    );
    expect(disableResponse?.status).toBe(200);
    await expect(disableResponse!.json()).resolves.toMatchObject({
      id: clientId,
      status: "disabled"
    });
  });
});
