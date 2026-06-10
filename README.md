# Teampitch Assistant

Personal Cloudflare-hosted assistant workspace.

The repo follows Turborepo-style directory conventions with plain Bun workspaces. Turbo is intentionally not installed yet; Bun workspaces are enough while there is one deployable app and a small set of shared packages.

## Apps

- `apps/worker`: Cloudflare Worker, Agents runtime, React client, and Wrangler config.

## Packages

- `packages/ui`: shared Coss UI primitives, shared UI hooks, and UI utilities consumed by `apps/worker`.
- `packages/evals`: assistant primitive eval harness for memory, retrieval, routing, and lifecycle behavior.

## Commands

Run these from the repo root:

```bash
bun install
bun dev
bun run check
bun run types
bun run deploy
```

`bun dev` delegates to `@teampitch/worker` and starts the Cloudflare/Vite dev server.

## Auth Identity

The assistant uses a provider-neutral auth identity adapter for memory grants. Local development defaults to the local adapter and does not require WorkOS credentials.

Optional environment variables:

- `AUTH_IDENTITY_ADAPTER`: set to `workos` to resolve identity from WorkOS/AuthKit access tokens. Omit or set to `local` for local fallback.
- `AUTH_LOCAL_SUBJECT_ID`: local private memory subject id. Defaults to `local-user`.
- `AUTH_LOCAL_TEAM_ID`: local team memory scope id. Defaults to `default-team`.
- `AUTH_LOCAL_ORG_ID`: local org memory scope id. Defaults to `default-org`.
- `AUTH_LOCAL_SESSION_ID`: local session memory scope id. Defaults to the current agent session id or `local-session`.
- `WORKOS_API_KEY`: WorkOS API key used by the Worker for AuthKit login, callback, refresh, and logout.
- `WORKOS_CLIENT_ID`: WorkOS client id used for AuthKit login and JWT/JWKS validation.
- `WORKOS_COOKIE_PASSWORD`: 32+ character password used by the WorkOS SDK to seal the HTTP-only session cookie.
- `WORKOS_API_HOSTNAME`: optional custom WorkOS API/auth hostname.
- `WORKOS_REDIRECT_URI`: optional explicit callback URL. Defaults to the current origin plus `/auth/callback`.
- `WORKOS_RETURN_TO`: optional post-logout URL. Defaults to the current origin root.
- `WORKOS_SESSION_COOKIE`: optional sealed session cookie name. Defaults to `wos-session`.
- `WORKOS_STATE_COOKIE`: optional login state cookie name. Defaults to `wos-login-state`.
- `WORKOS_JWKS_URL`: optional override for the WorkOS JWKS URL.
- `WORKOS_ACCESS_TOKEN_COOKIE`: optional cookie name for WorkOS access tokens. Defaults to `workos_access_token`.
- `WORKOS_ACCESS_TOKEN_QUERY_PARAM`: optional query parameter name for access tokens passed to Agent connections. Defaults to `access_token`; `token` is also accepted.

When `AUTH_IDENTITY_ADAPTER=workos`, the app exposes `/auth/login`, `/auth/callback`, `/auth/logout`, and `/auth/me`. Browser sessions use a sealed, HTTP-only WorkOS session cookie. Agent requests without a valid WorkOS session or access token fail closed instead of receiving local grants.

In the WorkOS dashboard, configure:

- Redirect URI: `<app origin>/auth/callback`
- Sign-in endpoint: `<app origin>/auth/login`
- Sign-out redirect: `<app origin>/`

## Structure

```txt
apps/
  worker/
    src/server.ts
    src/server/agents/
    src/server/memory/
    src/server/routing/
    src/features/
    src/components/app/
packages/
  ui/
    src/components/ui/
    src/hooks/
    src/lib/
  evals/
    src/
docs/
  adr/
  brainstorms/
```

## Architecture Notes

- Cloudflare Agent classes live in `apps/worker/src/server/agents`.
- The Worker entry stays thin at `apps/worker/src/server.ts`.
- Memory and routing primitives stay in `apps/worker/src/server`; `packages/evals` imports them through explicit Worker package exports.
- Coss UI primitives live in `packages/ui`; Teampitch-specific composition and icons stay in `apps/worker/src/components/app`.
