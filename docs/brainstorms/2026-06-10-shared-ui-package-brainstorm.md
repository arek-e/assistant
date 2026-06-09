---
date: 2026-06-10
topic: shared-ui-package
---

# Shared UI Package

## What We're Building

Move the installed Coss UI primitives out of the deployable Worker app and into `packages/ui`, while keeping Teampitch-specific composition in `apps/worker`.

## Why This Approach

The repo now has one real shared package need: Coss UI primitives are reusable, testable apart from the Worker runtime, and likely to be shared by future apps or tools. Moving memory, routing, or agent runtime code into packages is still premature because those primitives currently have one deployable consumer and Cloudflare-specific runtime assumptions.

## Key Decisions

- `packages/ui` owns `components/ui`, shared UI hooks, `cn`, and `components.json`.
- `apps/worker` depends on `@teampitch/ui` and imports primitives through package exports.
- `apps/worker/src/components/app` remains app-local for Teampitch wrappers, product-specific surface, and HugeIcons.
- Turbo remains deferred; root scripts delegate through Bun workspaces.

## Open Questions

- Whether to add `packages/contracts` after memory schemas gain a second consumer.
- Whether to add Turbo after package-level build caching or task graph orchestration becomes useful.
