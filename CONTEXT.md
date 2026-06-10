# Assistant

This context describes the personal Cloudflare-hosted assistant we are building. It keeps the shared language for memory, decision capture, retrieval, evaluation, routing, and self-improvement work.

## Language

**Record Admission Policy**:
The rules that decide whether something deserves durable memory. The assistant should not save everything; it should save only facts, preferences, decisions, lessons, and terms that have evidence or future value.
_Avoid_: Memory dump, auto-save everything

**Memory Record**:
A typed durable record that future assistant runs can consume. Each record has a kind, scope, status, evidence, rationale, timestamps, and consumer rules.
_Avoid_: Note, chat summary

**Memory Scope**:
The trust level that defines who may consume a Memory Record: Private Memory, Team Memory, Org Memory, or Session Memory.
_Avoid_: Storage namespace, arbitrary tag

**Private Memory**:
A Memory Record visible only to the person it belongs to.
_Avoid_: Personal memory, user-wide shared context

**Team Memory**:
A Memory Record shared within a defined team or project context.
_Avoid_: Workspace memory, project memory, repo memory

**Org Memory**:
A canonical Memory Record approved for organization-wide use.
_Avoid_: Global note, company trivia

**Session Memory**:
A Memory Record whose relevance is limited to one assistant session or audit trail.
_Avoid_: Durable product memory, team memory

**Memory Precedence**:
The rule that Org Memory overrides conflicting Team Memory, Team Memory overrides conflicting Private Memory, and non-conflicting lower-scope records remain usable context.
_Avoid_: Text relevance only, newest record wins

**Memory Promotion**:
The intentional act of creating a higher-scope Memory Record from a lower-scope insight with owner approval.
_Avoid_: Automatic sharing, scope mutation

**Content Hash**:
A stable fingerprint of the consumable content inside a Memory Record.
_Avoid_: Database id, cache key

**Record Hash**:
A stable fingerprint of a Memory Record's content and trust state.
_Avoid_: Content hash, row version

**Scope Root**:
A stable fingerprint of the current usable Memory Records within one Memory Scope.
_Avoid_: Projection version, global checksum

**Projection Root**:
A stable fingerprint of the Memory Record state that a search projection has actually indexed.
_Avoid_: Source of truth, vector truth

**Vector Candidate Retrieval**:
A retrieval step where a vector projection suggests relevant Memory Record ids without deciding whether those records are trustworthy or usable.
_Avoid_: Vector truth, embedding-backed answer

**Projection Freshness**:
The check that a projected Memory Record still matches the current Record Hash before it can be used as answer evidence.
_Avoid_: Whole-index freshness only, stale vector trust

**Freshness Degradation Policy**:
The rule that normal answers may ignore stale projection candidates while high-risk tasks block or require confirmation when freshness is uncertain.
_Avoid_: Always fail on stale projection, silently trust stale projection

**Memory Audit Automation**:
A scheduled or recurring check that detects stale projections, access drift, redacted content exposure, or provenance gaps in memory-backed answers.
_Avoid_: One-off debug check, manual inspection only

**WorkOS E2E Test**:
An opt-in or scheduled browser test that verifies real WorkOS authentication and organization membership produce the expected memory access context.
_Avoid_: Default PR gate, mocked identity test

**Auth Identity Adapter**:
The seam that converts an authenticated person and their organization memberships into the scopes the memory system may read.
_Avoid_: Memory permissions system, provider-specific user object

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

**Memory Debug Drawer**:
A developer-facing drawer that exposes durable memory records, retrieval evidence, blocked lifecycle candidates, memory tool calls, and route records. It exists to make the invisible assistant primitives auditable during the prototype phase.
_Avoid_: User-facing memory feed, analytics dashboard

**Effort Router**:
The component that decides how much machinery a task deserves. It routes the task mode, target agent, reasoning effort, budget, approval level, and evaluation tags before or during execution.
_Avoid_: Model picker, reasoning toggle

**Think Prototype**:
The Cloudflare Think-based assistant runtime now used as the main product path. It exists to prove and operate memory, tools, scheduling, MCP, and UI compatibility while we keep refining primitives.
_Avoid_: Temporary demo, parallel experiment

**Primitive-First Slice**:
The first Think prototype scope: one Think agent plus high-quality memory, routing, and evaluation tools. Agent roster and multiple specialized agents are deferred until the primitives prove useful.
_Avoid_: Agent marketplace, multi-agent UI first

**Trust-First Memory Slice**:
The next memory scope that proves access, lifecycle, hashes, provenance, and precedence before adding reusable vector or graph projections.
_Avoid_: Projection-first memory, vector-first trust

**WorkOS Auth Slice**:
The memory-auth integration slice that makes WorkOS populate the provider-neutral Auth Identity Adapter while keeping real WorkOS E2E tests opt-in.
_Avoid_: Auth-first memory rewrite, credentials-required test suite

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
The deployable Cloudflare Worker workspace containing Wrangler config, Worker entrypoint, Agent classes, React client, and Worker-specific tests. It is currently `apps/worker`.
_Avoid_: Backend folder, server-only package

**Shared UI Package**:
The workspace package containing reusable Coss UI primitives, shared UI hooks, and UI utility helpers. It is currently `packages/ui` and is consumed by `apps/worker`; app-specific composition, product copy, and HugeIcons wrappers stay in the Worker app.
_Avoid_: Design-system dumping ground, app-specific feature UI

**Reference Repository**:
An external codebase used for architecture comparison and implementation patterns, not as a dependency. OpenCode and T3 Code are reference repositories for package roles, agent runtime boundaries, session behavior, and operational safeguards.
_Avoid_: Copied source, cargo-cult template

**Contracts Package**:
A future package or source boundary containing only shared Effect Schema contracts and TypeScript types. It should not contain runtime logic, side effects, persistence, or UI state.
_Avoid_: Shared grab bag, utilities package

**Canonical Memory Store**:
The app-owned source of truth for durable typed records. Think context, search memory, and any future vector index should be projections from this store, not independent memory silos.
_Avoid_: Vector DB as source of truth, chat transcript store

**Canonical Memory Store Interface**:
The seam callers depend on when they read, write, promote, retrieve, or inspect Memory Records. It should hide whether the implementation uses Durable Object SQLite, Vectorize, a remote store, or an in-memory test adapter.
_Avoid_: SQLite class as product contract, storage-specific calls in tools

**Memory Store Adapter**:
A concrete implementation of the Canonical Memory Store Interface. The current adapters are Durable Object SQLite for the Think Prototype and in-memory storage for tests.
_Avoid_: Parallel memory silo, untyped storage helper

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
The state of a record: `draft`, `proposed`, `active`, `superseded`, `rejected`, or `redacted`. Redacted records may remain auditable but must not be consumed as content.
_Avoid_: Implicit truth

**Active Memory Evidence**:
A Memory Record that may be used as answer evidence because it is active, accessible, fresh, and not overridden by Memory Precedence.
_Avoid_: Proposed context, debug-only memory
