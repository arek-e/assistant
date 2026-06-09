# Assistant Eval Strategy

Status: proposed foundation note
Date: 2026-06-10

## Goal

The assistant should not trust memory, routing, or self-improvement primitives until they pass repeatable evals. The first evals should measure whether the primitives behave correctly before measuring whether the final answer sounds good.

## Eval Principles

Use deterministic checks first. Retrieval, lifecycle, admission, promotion, and routing can all be tested with seeded fixtures and exact assertions before any LLM judge is needed.

Keep evals close to product behavior. The suite should include realistic assistant tasks from this project, not only generic RAG examples.

Test the failure modes we actually fear:

- remembering too much
- retrieving stale or rejected records
- missing exact project terms
- overusing semantic search when lexical lookup is correct
- hiding unsupported claims in polished answers
- routing simple tasks through expensive paths
- promoting planned decisions to active truth too early

Treat every user correction, failed route, and retrieval miss as a candidate regression fixture.

## Fixture Shape

Each eval fixture should be versioned and include:

- `id`
- `category`: `retrieval`, `memory_write`, `lifecycle`, `routing`, or `integration`
- `seed_records`
- `workspace_files`, when file-native retrieval is expected
- `input`
- `expected_record_ids`
- `forbidden_record_ids`
- `expected_tool_calls`
- `forbidden_tool_calls`
- `expected_behavior`
- `metrics`
- `notes`

Retrieval fixtures should grade retrieved evidence before final answers. If the right records were not retrieved, the final answer should not be allowed to pass.

## First Eval Slices

### Retrieval

Exact lookup:
Seed an active decision that says the project uses Bun instead of npm. Ask a paraphrased but exact-intent question such as "what package runner did we choose?" The eval passes only if the Bun decision record is retrieved and npm-first alternatives are not treated as active truth.

Project vocabulary:
Seed term records for `Primitive-First Slice`, `Effort Router`, and `Routing Debug Drawer`. Ask "what did we mean by the hidden router UI?" The eval passes only if the debug drawer and routing audit records are retrieved.

Lifecycle conflict:
Seed an old active record superseded by a newer active record. The eval passes only if the newer active record wins and the superseded record is exposed only as history.

Rejected alternative:
Seed a rejected vector-first decision and the proposed SQLite + FTS5 retrieval decision. Ask "are we starting with vector memory?" The eval passes only if the assistant says no and retrieves the SQLite + FTS5 decision.

Semantic paraphrase:
Seed preference and mission records. Ask an indirect question that does not share keywords. The eval passes if the relevant record is retrieved without pulling unrelated broad matches.

Workspace retrieval:
Put implementation notes in docs or source files instead of memory. Ask for a file-native fact. The eval passes only if grep/bash retrieval finds the file artifact and the assistant does not require that fact to be copied into memory.

Negative retrieval:
Ask about a topic with no durable record. The eval passes only if the assistant does not hallucinate a remembered preference or decision.

### Memory Writes

Admission:
Give the assistant a transient chat fragment with no future value. The eval passes only if no durable record is written.

Explicit preference:
Have the user explicitly state a stable preference. The eval passes if a `preference_record` is written with evidence, scope, status, rationale, and consumer rules.

Decision capture:
Have the user choose between two meaningful alternatives. The eval passes if a `decision_record` includes alternatives, rationale, status, and re-eval trigger.

Promotion:
Start with a proposed decision and then provide implementation evidence. The eval passes if the record is promoted to `active` and the old state remains auditable.

### Routing

Simple answer:
Ask a low-risk factual question already covered by active context. The eval passes if the router chooses `direct` or low effort.

Tool task:
Ask for a codebase or Cloudflare action. The eval passes if the router chooses an agent/tool path and records the reason.

Escalation:
Start with a task that looks simple but reveals missing context. The eval passes if the route escalates and writes route regret or escalation evidence.

Budget discipline:
Run equivalent tasks through router-selected and always-high-effort baselines. The router must not spend more without better outcomes.

## Metrics

Track retrieval separately from answer quality:

- `retrieval_recall_at_5`
- `retrieval_precision_at_5`
- `forbidden_record_hits`
- `lifecycle_violations`
- `conflict_misses`
- `unsupported_answer_count`
- `tool_call_accuracy`
- `route_regret_rate`
- `cost_per_success`
- `latency_per_success`

For the first prototype, the hard gates should be:

- exact retrieval recall must be perfect on critical decision, preference, and term fixtures
- lifecycle violations must be zero
- forbidden record hits must be zero for rejected and superseded records
- memory write fixtures must include evidence and status
- route records must be written for non-trivial routing decisions

Semantic recall does not need to be perfect at first. Repeated semantic recall failures should create concrete fixtures and only then justify adding Vectorize.

## Implementation Shape

Start with the Bun-powered eval runner in `evals/run.ts` that tests primitive functions directly. The first version does not require a live model call for retrieval, lifecycle, or routing assertions. The runner uses the app-side `InMemoryCanonicalMemoryStore` so fixtures exercise the same memory API that can later be backed by Durable Object SQLite.

Run it with:

```sh
bun run evals
```

Suggested flow:

1. Seed a temporary Durable Object SQLite database or local SQLite-compatible test store.
2. Insert fixture records and optional workspace files.
3. Run the retrieval, memory write, promotion, or routing primitive.
4. Assert expected ids, forbidden ids, statuses, tool calls, and metrics.
5. Write a JSONL result trace to `.evals/latest.jsonl` for debugging and future regression mining.

Add LLM-as-judge only after deterministic primitive checks exist. Use it for final answer usefulness, tone, and ambiguity handling, not for deciding whether lifecycle and retrieval correctness passed.

## Regression Loop

When the assistant makes a bad memory or routing decision:

1. Save the failure as a fixture.
2. Mark the expected behavior.
3. Fix the primitive, prompt, schema, or retrieval path.
4. Re-run the full eval suite.
5. Create a `reflection_record` only if the failure suggests a durable assistant improvement.

This makes the assistant improve from evidence instead of self-editing from one-off impressions.
