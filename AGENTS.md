# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command          | Purpose                                |
| ---------------- | -------------------------------------- |
| `bun dev`        | Local development for `apps/worker`    |
| `bun run deploy` | Build and deploy to Cloudflare         |
| `bun run types`  | Generate TypeScript types              |
| `bun run check`  | Format, lint, typecheck, and run evals |

Run `bun run types` after changing bindings in `apps/worker/wrangler.jsonc`.

## Workspace Layout

This repo follows Turborepo-style directory conventions with plain Bun workspaces. Do not add Turbo until task graph orchestration, caching, or more package/app orchestration make it worth the extra dependency.

- `apps/worker`: Cloudflare Worker, React client, Cloudflare Agent classes, and Wrangler config.
- `packages/ui`: shared Coss UI primitives, shared UI hooks, and UI utilities.
- `packages/evals`: assistant primitive behavior gates for memory, retrieval, routing, and lifecycle behavior.
- `docs`: architecture notes, ADRs, brainstorms, and product context.
- Future `packages/*`: reusable contracts, memory, or agent-core packages. Create these only when code must be shared across apps or tested independently.

## Source Ownership

This repo started from the Cloudflare Agents starter, but should now be treated as a product codebase with explicit runtime boundaries.

- `apps/worker/src/server.ts`: Cloudflare Worker entry. Keep it thin: export Durable Object classes and route requests.
- `apps/worker/src/server/agents`: Cloudflare Agent classes and actor lifecycle behavior.
- `apps/worker/src/server/memory`: canonical memory records, retrieval, lifecycle, and memory tools.
- `apps/worker/src/server/routing`: Effort Router logic and routing audit primitives.
- `apps/worker/src/server/assistant-*.ts`: shared assistant prompt/tool runtime used by multiple agents.
- `apps/worker/src/features`: user-facing React workflows.
- `apps/worker/src/components/app`: app-specific composition, icons, and wrappers.
- `packages/evals`: primitive behavior gates. Memory, retrieval, routing, and self-improvement changes should extend or preserve these evals.
- `packages/ui/src/components/ui`: installed Coss UI primitives. Do not hand-roll replacements without a reason.
- `packages/ui/components.json`: Coss UI registry config. Run future Coss UI component installs from `packages/ui` so primitives stay shared.

Prefer moving code toward these boundaries over adding more template-style files at the root of `apps/worker/src/server`.

## Reference Repos

- OpenCode: https://github.com/anomalyco/opencode
- T3 Code: https://github.com/pingdotgg/t3code

Use these as structural references for long-term maintainability: thin entrypoints, explicit runtime ownership, package roles, contracts separated from runtime logic, and documented operational safeguards. Do not import from copied or vendored reference code unless the repo is intentionally configured for that.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
