---
date: 2026-06-10
topic: repo-structure-reference
---

# Repo Structure Reference

## What We're Building

The Cloudflare starter layout is good for bootstrapping, but the assistant is now becoming a product with runtime primitives: agents, memory, retrieval, routing, tools, evals, and UI surfaces. The repo should stop looking like a template and start making ownership boundaries obvious.

The references are OpenCode and T3 Code:

- OpenCode: package-scoped runtime ownership, explicit agent/tool/session concepts, and repo-local automation conventions.
- T3 Code: `apps/*` for deployable applications, `packages/*` for contracts/shared runtime, docs for architecture and operations, and explicit package-role guidance in `AGENTS.md`.

## Why This Approach

Use Turborepo-style directory conventions, but do not add Turbo yet. This app still deploys as one Cloudflare Worker plus one React UI, so plain Bun workspaces are enough until task graph orchestration, build caching, or multiple active packages make Turbo worth the dependency.

The better first step is to make the current app an explicit workspace package while keeping shared packages deferred:

- Put the current Cloudflare app in `apps/worker`.
- Keep the Worker entry thin.
- Put Cloudflare Agent classes under `apps/worker/src/server/agents`.
- Keep memory, retrieval, routing, and primitive tools as named server domains.
- Keep evals as a first-class gate inside the worker package.
- Document the later monorepo shape so future moves are deliberate.

## Key Decisions

- The root `package.json` is a Bun workspace root with `workspaces: ["apps/*"]`.
- The current app lives in `apps/worker` as package `@teampitch/worker`.
- Agent classes live in `apps/worker/src/server/agents`: this separates runtime actors from shared server primitives.
- `apps/worker/src/server.ts` remains the Worker entry: it should export bindings and route requests, not own agent behavior.
- No `packages/*` split yet: defer until there is another deployable target, shared SDK, or reusable contracts package.
- Effect Schema remains the contract language: if a `packages/contracts` split happens later, it should be schema-only with no runtime side effects.
- Reference repos are links for now, not vendored code: vendoring `.repos/` can come later if we need offline/local source inspection.

## Open Questions

- When should `apps/worker/src/server/assistant-tools.ts` split into `apps/worker/src/server/tools/*`?
- Should memory schemas move to a future `src/contracts` or `packages/contracts` before the full monorepo split?
- Do we want a `.repos/` sync script like T3 Code, or are linked references enough for now?

## Next Steps

- Move the current app under `apps/worker`.
- Move agent classes under `apps/worker/src/server/agents`.
- Update `AGENTS.md` with source ownership boundaries and reference repositories.
- Re-run the existing check gate.
