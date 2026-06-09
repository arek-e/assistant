---
status: proposed
---

# Prototype on Cloudflare Think first

We will explore the next assistant foundation by migrating toward Cloudflare Think before building custom memory primitives on the current `AIChatAgent` harness. This intentionally chooses runtime alignment first: if Think's built-in memory, context, search, and agent lifecycle model fits the product, our record admission policy and Effect Schema memory tools should be shaped around that harness instead of retrofitted later. The trade-off is that we take on migration risk earlier, so this decision should become `accepted` only after a working Think prototype proves that the harness can support the personal assistant memory model described in `docs/assistant-memory-primitives.md`.

The migration shape is a parallel Think Prototype, not an immediate replacement. We will keep the existing `ChatAgent` path intact while adding a Think-based agent that can prove UI compatibility, Effect Schema tool compatibility, scheduling behavior, MCP behavior, and durable memory semantics. If the prototype passes those checks, we can promote it to the main assistant and update this ADR from `proposed` to `accepted`.
