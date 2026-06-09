# Teampitch Assistant

Personal Cloudflare-hosted assistant workspace.

The repo follows Turborepo-style directory conventions with plain Bun workspaces. Turbo is intentionally not installed yet; Bun workspaces are enough while there is one deployable app.

## Apps

- `apps/worker`: Cloudflare Worker, Agents runtime, React client, Wrangler config, and primitive evals.

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
    src/components/
    evals/
docs/
  adr/
  brainstorms/
```

## Architecture Notes

- Cloudflare Agent classes live in `apps/worker/src/server/agents`.
- The Worker entry stays thin at `apps/worker/src/server.ts`.
- Memory, routing, and eval primitives stay app-local until they need to be shared.
- Future reusable code should move into `packages/*` only when there is a second consumer.
