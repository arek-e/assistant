import { Schema } from "effect";
import { tool, type ToolSet } from "ai";
import { effectInputSchema } from "@/server/effect-schema";
import { routeTask } from "@/server/routing/effort-router";
import type { SqliteCanonicalMemoryStore } from "./sqlite-memory-store";
import type { MemoryRecord } from "./types";

const memoryKindSchema = Schema.Literal(
  "term_record",
  "decision_record",
  "preference_record",
  "learning_record",
  "mission_record",
  "resource_record",
  "reflection_record",
  "task_record",
  "route_record"
);

const lifecycleStatusSchema = Schema.Literal(
  "draft",
  "proposed",
  "active",
  "superseded",
  "rejected"
);

const memoryScopeSchema = Schema.Literal("user", "project", "repo", "session");

const recordMemoryInputSchema = effectInputSchema(
  Schema.Struct({
    id: Schema.String.annotations({
      description: "Stable memory record id, such as preference.ui.hugeicons"
    }),
    kind: memoryKindSchema,
    scope: memoryScopeSchema,
    status: lifecycleStatusSchema,
    title: Schema.String,
    body: Schema.String,
    evidence: Schema.String,
    rationale: Schema.String,
    reEvalTrigger: Schema.String,
    consumerRules: Schema.Array(Schema.String),
    tags: Schema.Array(Schema.String),
    supersedes: Schema.Array(Schema.String)
  })
);

const recordDecisionInputSchema = effectInputSchema(
  Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    body: Schema.String,
    evidence: Schema.String,
    rationale: Schema.String,
    status: lifecycleStatusSchema,
    alternatives: Schema.Array(Schema.String),
    reEvalTrigger: Schema.String,
    tags: Schema.Array(Schema.String)
  })
);

const searchMemoryInputSchema = effectInputSchema(
  Schema.Struct({
    query: Schema.String.annotations({
      description: "Memory search query"
    })
  })
);

const promoteRecordInputSchema = effectInputSchema(
  Schema.Struct({
    recordId: Schema.String,
    status: lifecycleStatusSchema
  })
);

const routeTaskInputSchema = effectInputSchema(
  Schema.Struct({
    input: Schema.String
  })
);

export function createMemoryPrimitiveTools(
  store: SqliteCanonicalMemoryStore
): ToolSet {
  return {
    recordMemory: tool({
      description:
        "Save a typed durable memory record with evidence, lifecycle status, and consumer rules.",
      inputSchema: recordMemoryInputSchema,
      execute: async (input) => {
        const record = store.upsert(toMemoryRecord(input));
        return { saved: true, record };
      }
    }),

    recordDecision: tool({
      description:
        "Save a proposed or active decision with rationale, alternatives, and a re-evaluation trigger.",
      inputSchema: recordDecisionInputSchema,
      execute: async (input) => {
        const record = store.upsert(
          toMemoryRecord({
            id: input.id,
            kind: "decision_record",
            scope: "project",
            status: input.status,
            title: input.title,
            body: `${input.body}\n\nAlternatives considered:\n${input.alternatives
              .map((item) => `- ${item}`)
              .join("\n")}`,
            evidence: input.evidence,
            rationale: input.rationale,
            reEvalTrigger: input.reEvalTrigger,
            consumerRules: [
              "Use only when status is active",
              "If proposed, cite as intent rather than implemented behavior"
            ],
            tags: input.tags,
            supersedes: []
          })
        );
        return { saved: true, record };
      }
    }),

    searchMemory: tool({
      description:
        "Search durable assistant memory. Use before answering questions about project decisions, preferences, terms, or prior choices.",
      inputSchema: searchMemoryInputSchema,
      execute: async ({ query }) => {
        const result = store.search(query);
        return {
          records: result.hits.map((hit) => ({
            id: hit.record.id,
            title: hit.record.title,
            kind: hit.record.kind,
            status: hit.record.status,
            body: hit.record.body,
            evidence: hit.record.evidence,
            score: hit.score,
            reasons: hit.reasons
          })),
          lifecycleViolations: result.lifecycleViolations
        };
      }
    }),

    promoteRecord: tool({
      description:
        "Move a durable memory record between lifecycle states such as proposed, active, superseded, and rejected.",
      inputSchema: promoteRecordInputSchema,
      execute: async ({ recordId, status }) => {
        const record = store.promote(recordId, status);
        return record
          ? { promoted: true, record }
          : {
              promoted: false,
              error: `No memory record found for ${recordId}`
            };
      }
    }),

    routeTask: tool({
      description:
        "Make an internal Effort Router decision for a task using current memory retrieval evidence.",
      inputSchema: routeTaskInputSchema,
      execute: async ({ input }) => {
        const retrieval = store.search(input);
        const route = routeTask(input, retrieval);
        return {
          route,
          retrievedRecordIds: retrieval.hits.map((hit) => hit.record.id)
        };
      }
    })
  };
}

function toMemoryRecord(
  input: Omit<MemoryRecord, "createdAt" | "updatedAt">
): MemoryRecord {
  const now = new Date().toISOString();

  return {
    ...input,
    createdAt: now,
    updatedAt: now
  };
}
