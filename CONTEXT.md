# Assistant

This context describes the personal Cloudflare-hosted assistant we are building. It keeps the shared language for memory, decision capture, retrieval, evaluation, routing, and self-improvement work.

## Language

**Record Admission Policy**:
The rules that decide whether something deserves durable memory. The assistant should not save everything; it should save only facts, preferences, decisions, lessons, and terms that have evidence or future value.
_Avoid_: Memory dump, auto-save everything

**Memory Record**:
A typed durable record that future assistant runs can consume. Each record has a kind, scope, status, evidence, rationale, timestamps, and consumer rules.
_Avoid_: Note, chat summary

**Term Record**:
A canonical vocabulary entry for project-specific language. It exists to compress future communication and should not contain implementation details.
_Avoid_: Spec entry, implementation note

**Decision Record**:
A durable record of a consequential choice, its rationale, the alternatives considered, and when to revisit it. It should be created only when the decision is hard to reverse, surprising without context, and the result of a real trade-off.
_Avoid_: Meeting note, task log

**Preference Record**:
A durable record of a stable user preference. It should be created when the user states a preference explicitly or repeats the same preference across sessions.
_Avoid_: One-off comment

**Learning Record**:
A durable record that the user has demonstrated understanding, disclosed prior knowledge, corrected a misconception, or shifted a mission. It should not be created merely because material was covered.
_Avoid_: Lesson log, session recap

**Mission Record**:
A concise record of why a project or learning track exists. It acts as a compass for choosing what to do next.
_Avoid_: Roadmap, backlog

**Reflection Record**:
A proposed assistant improvement derived from traces, failed evals, or repeated friction. It should be reviewed before changing prompts, tools, schemas, or skills.
_Avoid_: Automatic self-modification

**Route Record**:
A durable record of an Effort Router decision and its outcome. It captures the chosen mode, agent, effort, budget, rationale, cost, latency, user corrections, and whether the route should influence future routing.
_Avoid_: Router log, trace dump

**Routing Audit Trail**:
The internal, inspectable history of Effort Router choices and outcomes. It exists for debugging, evaluation, and improvement, not for the normal user-facing chat experience.
_Avoid_: User route chip, visible routing UI

**Routing Debug Drawer**:
A developer-facing drawer or popover that exposes the Routing Audit Trail. It can later be controlled by a feature flag, but may be visible by default during the prototype phase.
_Avoid_: Main routing UI, user-facing route picker

**Effort Router**:
The component that decides how much machinery a task deserves. It routes the task mode, target agent, reasoning effort, budget, approval level, and evaluation tags before or during execution.
_Avoid_: Model picker, reasoning toggle

**Think Prototype**:
The Cloudflare Think-based assistant runtime now used as the main product path. It exists to prove and operate memory, tools, scheduling, MCP, and UI compatibility while we keep refining primitives.
_Avoid_: Temporary demo, parallel experiment

**Primitive-First Slice**:
The first Think prototype scope: one Think agent plus high-quality memory, routing, and evaluation tools. Agent roster and multiple specialized agents are deferred until the primitives prove useful.
_Avoid_: Agent marketplace, multi-agent UI first

**Legacy ChatAgent**:
The previous `AIChatAgent` Durable Object class. It is no longer user-facing and has been removed from Worker code and bindings. Wrangler migration `v3` deletes this class, which will delete stored `ChatAgent` Durable Objects when deployed.
_Avoid_: Active assistant, fallback product path

**Primitive Tool**:
A foundational assistant tool that manages durable records, routing, or self-improvement behavior. Primitive tools are more important than domain tools in the first Think prototype because they define how the assistant learns, decides, and audits itself.
_Avoid_: Feature tool, demo tool

**Runtime Boundary**:
A source ownership boundary that separates deployable entrypoints, Cloudflare Agent actors, durable primitives, UI workflows, and shared contracts. Runtime boundaries should be visible in directory structure before the repo grows into a full monorepo.
_Avoid_: Template folder, arbitrary module group

**Bun Workspace Root**:
The repository-level package that declares workspaces and delegates scripts to app or package workspaces. It should not own application runtime dependencies unless they are truly root-level tooling.
_Avoid_: App package, dependency dumping ground

**Worker App**:
The deployable Cloudflare Worker workspace containing Wrangler config, Worker entrypoint, Agent classes, React client, and app-specific evals. It is currently `apps/worker`.
_Avoid_: Backend folder, server-only package

**Reference Repository**:
An external codebase used for architecture comparison and implementation patterns, not as a dependency. OpenCode and T3 Code are reference repositories for package roles, agent runtime boundaries, session behavior, and operational safeguards.
_Avoid_: Copied source, cargo-cult template

**Contracts Package**:
A future package or source boundary containing only shared Effect Schema contracts and TypeScript types. It should not contain runtime logic, side effects, persistence, or UI state.
_Avoid_: Shared grab bag, utilities package

**Canonical Memory Store**:
The app-owned source of truth for durable typed records. Think context, search memory, and any future vector index should be projections from this store, not independent memory silos.
_Avoid_: Vector DB as source of truth, chat transcript store

**Retrieval Ladder**:
The ordered retrieval strategy for memory and project knowledge: active context first, typed SQL lookup second, FTS5 lexical search third, workspace grep/bash fourth, and vector or graph retrieval only after evals prove they are needed.
_Avoid_: One retrieval method, vector-first memory

**Think Context Projection**:
The small set of active records projected from the Canonical Memory Store into Think's context blocks for a run. It should contain the current mission, stable preferences, active decisions, and any task-relevant records.
_Avoid_: Dump all memories into context

**Retrieval Eval**:
A test case that checks whether retrieval returns the right evidence before the assistant answers. Good retrieval evals cover exact lookup, semantic paraphrase, stale or superseded records, conflicts, negative cases, and safety boundaries.
_Avoid_: Vibe check, answer-only eval

**Eval Fixture**:
A versioned test case with seeded records, a user input, expected retrieved record ids, forbidden record ids, expected behavior, and measurable pass/fail checks.
_Avoid_: Example prompt, demo transcript

**Eval Gate**:
A threshold that must pass before changing memory, retrieval, routing, or self-improvement behavior. Eval gates should protect against regressions and decide when extra machinery such as Vectorize is justified.
_Avoid_: Benchmark vanity metric

**Lifecycle Status**:
The state of a record: `draft`, `proposed`, `active`, `superseded`, or `rejected`. Planned decisions should not be consumed as current truth until promoted to `active`.
_Avoid_: Implicit truth
