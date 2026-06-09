# Assistant Memory Primitives

Status: proposed foundation note
Date: 2026-06-09

## Why This Exists

We want the assistant to become more useful over time without turning memory into an unstructured transcript dump. The useful pattern from Matt Pocock's skills is not just "write things down"; it is "write the right artifact at the right time, with admission rules."

This note records the memory and decision-capture rules we want to carry forward when we return to the Cloudflare Think / personal OpenClaw-style assistant design.

## Sources Considered

- Matt Pocock skills repo: https://github.com/mattpocock/skills
- `grill-with-docs`: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/grill-with-docs/SKILL.md
- `teach`: https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/teach/SKILL.md
- Durable grill decisions issue: https://github.com/mattpocock/skills/issues/311
- Proposed ADR poisoning issue: https://github.com/mattpocock/skills/issues/299
- Cloudflare Think tools: https://developers.cloudflare.com/agents/harnesses/think/tools/
- Cloudflare Think configuration: https://developers.cloudflare.com/agents/harnesses/think/configuration/
- Cloudflare Durable Object SQLite API: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Cloudflare Vectorize: https://developers.cloudflare.com/vectorize/
- Hybrid retrieval survey: https://arxiv.org/html/2508.01405v2
- Dynamic sparse/dense retrieval weighting: https://arxiv.org/html/2503.23013v1
- BM25-to-corrective-RAG benchmark: https://arxiv.org/html/2604.01733v1

## Core Lesson

Memory should be typed, evidence-gated, and lifecycle-aware.

The assistant should not save every chat message into long-term memory. It should run a record admission policy that decides whether a fact, term, preference, decision, or lesson has enough future value to become durable.

## Memory Record Types

- `term_record`: canonical project vocabulary.
- `decision_record`: choice, rationale, alternatives, and re-eval trigger.
- `preference_record`: stable user preference, explicit or repeated.
- `learning_record`: demonstrated understanding, prior knowledge, corrected misconception, or mission shift.
- `mission_record`: why a project or learning track exists.
- `resource_record`: trusted source and when to use it.
- `reflection_record`: assistant self-improvement proposal.
- `task_record`: scheduled, active, or completed work item.
- `route_record`: Effort Router decision, observed outcome, and whether the route should be reused or revised.

## Shared Record Shape

Every durable record should include:

- `kind`
- `scope`: `user`, `project`, `repo`, or `session`
- `status`: `draft`, `proposed`, `active`, `superseded`, or `rejected`
- `evidence`
- `rationale`
- `created_at`
- `updated_at`
- `re_eval_trigger`
- `consumer_rules`

## Admission Rules

Save a term when the language is settled and project-specific.

Save a decision when the rationale would be costly to reconstruct later, especially when the choice is hard to reverse, surprising without context, and the result of a real trade-off.

Save a preference when the user states it explicitly or demonstrates it repeatedly.

Save a learning record only after evidence. Coverage is not learning.

Save a mission when future choices need a compass.

Save a reflection when an assistant improvement is supported by traces, eval failures, repeated correction, or repeated friction.

Save a route record when the Effort Router makes a non-trivial choice about direct answer vs agent execution, target agent, reasoning effort, budget, or approval level.

## Lifecycle Rules

Planned decisions start as `proposed`, not `active`.

Promote a decision to `active` only when the implementation, configuration, or behavior actually exists.

Mark older records as `superseded` instead of deleting them when the history is useful.

Use `rejected` for alternatives that are likely to be suggested again.

## Consumer Rules

The assistant may rely on `active` records as current truth.

The assistant may cite `proposed` records as intent, but must not treat them as implemented behavior.

The assistant should use `term_record` entries to keep naming and explanations concise.

The assistant should use `mission_record` entries to decide what to do next when the user is underspecified.

The assistant should use `reflection_record` entries to propose prompt, tool, schema, or skill changes, but not auto-apply them without approval.

The assistant should use `route_record` entries as early experience for future routing decisions, especially when a cheaper route worked, a simple route failed, or user intervention corrected the route.

## Retrieval Foundation

Use a Canonical Memory Store as the source of truth for durable records. For the first Think Prototype, this should be an app-owned Durable Object SQLite store with typed records, JSON metadata, lifecycle status, and FTS5 indexes over searchable text.

Think context and search memory should be projections from the Canonical Memory Store. The assistant should project only the current mission, active preferences, active decisions, and task-relevant memory into Think context blocks. It should not dump all durable memory into the model context.

Initial Retrieval Ladder:

1. Think Context Projection: always-on active records that are small enough to keep in context.
2. Typed SQL lookup: exact filters by `kind`, `scope`, `status`, project, date, source, and lifecycle.
3. FTS5 lexical search: exact terms, names, paths, tool names, dates, quotes, and project vocabulary.
4. Workspace grep/bash: repository files, docs, logs, traces, and local artifacts that should stay file-native.
5. Vector search: defer Cloudflare Vectorize until retrieval evals prove semantic recall is missing.
6. Graph retrieval: defer until memory becomes relationship-heavy enough that SQL joins and record links are not enough.

Do not start vector-first. Dense vector retrieval is useful for semantic mismatch, but the assistant's early memory problems are more likely to be exactness, lifecycle correctness, conflicts, and auditability. If Vectorize is added later, use it as a hybrid retrieval layer beside SQL and FTS5, not as the source of truth.

## Eval Strategy

Good evals are part of the foundation, not a later polish pass. Before we trust memory, routing, or self-improvement, the assistant needs repeatable evals that check the primitive behavior directly.

The detailed eval plan lives in `docs/assistant-eval-strategy.md`. This section captures the memory-specific requirements that plan must enforce.

The first eval suite should test retrieval before answer quality:

- Exact recall: names, dates, paths, tool names, decision ids, and project terms are retrieved.
- Semantic recall: paraphrased user requests find the correct memory records.
- Lifecycle correctness: `proposed`, `rejected`, and `superseded` records are not treated as active truth.
- Conflict handling: newer active records beat older superseded records, and unresolved conflicts are surfaced.
- Negative retrieval: irrelevant records are not pulled into context just because they share broad vocabulary.
- Grounded answers: answers that use memory cite or expose the record ids and evidence internally for audit.
- Workspace retrieval: docs and code artifacts are found through grep/bash when they should not be copied into memory.
- Safety boundaries: private, temporary, or low-confidence notes do not leak into normal answers.

Track retrieval metrics separately from final answer metrics:

- recall@k for expected record ids
- precision@k for noise in retrieved records
- lifecycle violation count
- conflict miss count
- unsupported answer count
- latency and token cost per retrieval path

The first eval suite should also test memory writes and routing:

- Memory write evals check record kind, scope, evidence, status, rationale, and re-eval trigger.
- Admission evals check that low-value chat fragments are not saved.
- Promotion evals check that planned decisions do not become `active` without evidence.
- Route evals compare router-selected paths against baselines for success, route regret, cost, latency, escalation failures, and user correction rate.

Vectorize should be introduced only when the eval suite shows repeated semantic recall failures that SQL + FTS5 + grep cannot handle cleanly. Graph retrieval should be introduced only when evals show repeated multi-hop relationship failures that typed links and SQL cannot handle cleanly.

## Effort Router

The Effort Router decides how much machinery a task deserves. It should not be limited to model selection.

Routing should be invisible in the normal chat experience. The user should not need to see route chips or make routing choices unless they explicitly open a debug or audit view. The system still needs a complete Routing Audit Trail so routing decisions can be inspected, evaluated, replayed, and improved.

During the prototype phase, expose the audit view through a Routing Debug Drawer or popover that is available by default. Later, move it behind a feature flag or developer-mode setting if it becomes distracting.

Initial route shape:

- `mode`: `direct`, `agent`, `sub_agent`, or `workflow`
- `target_agent_id`
- `effort`: `low`, `medium`, or `high`
- `budget`: `small`, `standard`, or `extended`
- `reason`
- `confidence`
- `eval_tags`
- `requires_approval`

Start with a rubric-based router, not a trained router. Log routing decisions, cost, latency, user corrections, outcome, and route regret. Once we have enough traces, use those route records as early experience for evaluation or training.

Evaluate the Effort Router against simple baselines:

- always direct
- always main assistant
- always highest effort
- static rules
- router-selected path

The first useful metrics are task success, route regret, escalation failure, token cost, latency, user correction rate, and memory safety violations.

## How This Maps Back To The Assistant Foundation

When we return to the Cloudflare Think / personal OpenClaw-style design, the next prototype should include:

1. A Canonical Memory Store for the record types above, backed first by Durable Object SQLite + FTS5.
2. Effect Schema definitions for each record shape.
3. Tools such as `remember`, `searchMemory`, `recordDecision`, `updatePreference`, and `proposeReflection`.
4. A promotion path from `proposed` to `active`.
5. An eval suite that checks retrieval, memory writes, lifecycle behavior, and routing before we trust it.
6. An Effort Router that chooses direct answer vs agent/sub-agent/workflow, target agent, reasoning effort, and budget.

The immediate design goal is not a Gumloop-style workflow builder or an agent marketplace. It is a Primitive-First Slice: one Think agent with disciplined memory, explicit decisions, hidden-but-auditable routing, and safe self-improvement loops. Agent roster UI and specialized sub-agents should wait until the primitives prove useful.

## First Primitive Tool Set

The first Think prototype should start with this small primitive tool set:

- `recordMemory`: save a typed memory record with evidence and lifecycle status.
- `searchMemory`: retrieve relevant records across durable memory.
- `recordDecision`: save a proposed or active decision with rationale, alternatives, and re-eval trigger.
- `promoteRecord`: move a record between lifecycle states such as `proposed`, `active`, `superseded`, and `rejected`.
- `routeTask`: make an internal Effort Router decision and write a `route_record`.
- `proposeReflection`: suggest an improvement to prompts, tools, schemas, skills, or evals based on traces, route records, corrections, or eval failures.

Domain tools can come later. The first slice should prove that durable memory, explicit decisions, hidden routing, and auditable self-improvement work correctly.
