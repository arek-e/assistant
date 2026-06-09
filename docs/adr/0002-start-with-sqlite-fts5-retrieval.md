---
status: proposed
---

# Start with SQLite and FTS5 retrieval

We will use an app-owned Durable Object SQLite store as the Canonical Memory Store for the first Think Prototype. Durable memory records will be typed, lifecycle-aware, and indexed for exact SQL lookup plus FTS5 lexical search. Think context blocks and any future search memory will be projections from this canonical store.

This means we are not starting with a vector database as the source of truth. Vectorize may be added later, but only as a hybrid retrieval layer when evals show repeated semantic recall failures that SQL, FTS5, and workspace grep cannot handle cleanly.

## Context

The assistant's early memory risks are exactness, lifecycle correctness, conflicts, and auditability. A vector-first design would make semantic recall easier to prototype, but it would make source-of-truth semantics, record promotion, deletion, conflict handling, and debugging harder than they need to be.

Recent retrieval work supports a hybrid view: sparse lexical retrieval remains strong for exact terms and domain vocabulary, dense vectors help semantic mismatch, and fixed hybrid weighting can be brittle. That suggests we should measure our failures before adding more retrieval machinery.

## Decision

The initial Retrieval Ladder is:

1. Think Context Projection for small always-on active records.
2. Typed SQL lookup for exact filters and lifecycle-aware retrieval.
3. FTS5 lexical search for names, terms, dates, paths, and project vocabulary.
4. Workspace grep/bash for repo files, docs, logs, traces, and local artifacts.
5. Vectorize only after evals prove semantic recall is missing.
6. Graph retrieval only after evals prove relationship-heavy multi-hop recall is missing.

## Eval Gates

Before adding Vectorize, the eval suite should show repeated failures in semantic recall where:

- the expected memory record is not found by SQL, FTS5, or grep;
- the query is genuinely semantic rather than an exact lookup bug;
- adding synonyms, term records, or better FTS fields would not solve it cleanly;
- the failure matters for a real assistant task.

Before adding graph retrieval, the eval suite should show repeated relationship failures where:

- the answer requires traversing linked people, projects, records, tools, or decisions;
- SQL joins or explicit record links are not enough;
- flat retrieval produces either missing evidence or too much irrelevant context.

## Consequences

This keeps the first prototype debuggable and cheap. It also forces us to build good retrieval evals early, because the decision to add vector or graph retrieval should be evidence-based.

The trade-off is that semantic memory search may be weaker at first. We accept that risk because it is easier to add a hybrid vector layer later than to recover clean lifecycle semantics from a vector-first memory system.
