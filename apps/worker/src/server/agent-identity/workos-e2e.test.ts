import { describe, expect, test } from "bun:test";

import { handleAgentIdentityRequest } from "./routes";
import { pkceChallenge } from "./tokens";

const workOSE2EEnabled = Boolean(
  process.env.WORKOS_API_KEY &&
  process.env.WORKOS_CLIENT_ID &&
  process.env.WORKOS_COOKIE_PASSWORD &&
  process.env.WORKOS_E2E_ADMIN_SESSION_COOKIE
);
const testWorkOSE2E = workOSE2EEnabled ? test : test.skip;

describe("WorkOS agent identity E2E", () => {
  testWorkOSE2E("authorizes and exchanges an agent token through WorkOS session auth", async () => {
    const env = workOSE2EEnv();
    const cookie = `wos-session=${encodeURIComponent(
      process.env.WORKOS_E2E_ADMIN_SESSION_COOKIE ?? ""
    )}`;
    const clientId = `workos-e2e-${crypto.randomUUID()}`;
    const verifier = "workos-e2e-code-verifier";
    const redirectUri = "http://localhost:8787/callback";

    const createClientResponse = await handleAgentIdentityRequest(
      new Request("https://assistant.test/api/agent-oauth-clients", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          clientId,
          name: "WorkOS E2E Client",
          redirectUris: [],
          allowLocalRedirects: true,
          allowedCapabilities: ["memory:read"]
        })
      }),
      env
    );

    expect(createClientResponse?.status).toBe(201);

    const authorizeResponse = await handleAgentIdentityRequest(
      new Request(
        `https://assistant.test/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&code_challenge=${await pkceChallenge(
          verifier
        )}&code_challenge_method=S256&scope=memory:read&state=e2e-state`,
        { headers: { cookie } }
      ),
      env
    );

    expect(authorizeResponse?.status).toBe(302);
    const location = authorizeResponse?.headers.get("location");
    expect(location).toBeTruthy();
    const code = new URL(location ?? "").searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await handleAgentIdentityRequest(
      new Request("https://assistant.test/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier
        })
      }),
      env
    );

    expect(tokenResponse?.status).toBe(200);
    await expect(tokenResponse?.json()).resolves.toMatchObject({
      token_type: "Bearer",
      scope: "memory:read"
    });
  });
});

function workOSE2EEnv() {
  return {
    AUTH_IDENTITY_ADAPTER: "workos",
    WORKOS_API_KEY: process.env.WORKOS_API_KEY,
    WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID,
    WORKOS_COOKIE_PASSWORD: process.env.WORKOS_COOKIE_PASSWORD,
    WORKOS_API_HOSTNAME: process.env.WORKOS_API_HOSTNAME,
    WORKOS_SESSION_COOKIE: "wos-session",
    AGENT_ACCESS_TOKEN_SECRET:
      process.env.AGENT_ACCESS_TOKEN_SECRET ?? process.env.WORKOS_COOKIE_PASSWORD
  };
}
