# Teampitch Assistant

Personal Cloudflare-hosted assistant workspace.

The repo follows Turborepo-style directory conventions with plain Bun workspaces. Turbo is intentionally not installed yet; Bun workspaces are enough while there is one deployable app and one shared UI package.

## Apps

- `apps/worker`: Cloudflare Worker, Agents runtime, React client, Wrangler config, and primitive evals.

## Packages

- `packages/ui`: shared Coss UI primitives, shared UI hooks, and UI utilities consumed by `apps/worker`.

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
    evals/
packages/
  ui/
    src/components/ui/
    src/hooks/
    src/lib/
docs/
  adr/
  brainstorms/
```

## Architecture Notes

- Cloudflare Agent classes live in `apps/worker/src/server/agents`.
- The Worker entry stays thin at `apps/worker/src/server.ts`.
- Memory, routing, and eval primitives stay app-local until they need to be shared.
- Coss UI primitives live in `packages/ui`; Teampitch-specific composition and icons stay in `apps/worker/src/components/app`.
