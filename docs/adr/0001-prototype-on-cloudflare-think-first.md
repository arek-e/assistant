---
status: accepted
---

# Prototype on Cloudflare Think first

We will build the assistant foundation on Cloudflare Think instead of the previous `AIChatAgent` harness. This intentionally chooses runtime alignment first: Think's memory, context, search, and agent lifecycle model should shape our record admission policy and Effect Schema memory tools instead of being retrofitted later.

The Think prototype has been promoted to the main user-facing assistant path. The React client connects directly to `ThinkAgent`; the Chat/Think switch has been removed.

The legacy `ChatAgent` Durable Object class has been removed from Worker code and Wrangler bindings. Wrangler migration `v3` declares `deleted_classes: ["ChatAgent"]`; deploying this migration will delete stored Durable Objects for that class.
