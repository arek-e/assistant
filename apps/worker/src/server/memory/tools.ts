import { Schema } from "effect";
import { tool, type ToolSet } from "ai";
import { effectInputSchema } from "@/server/effect-schema";
import { routeTask, type RouteDecision } from "@/server/routing/effort-router";
import {
  createLocalMemoryAccessContext,
  findMemoryScopeId,
  type MemoryAccessContext
} from "./access";
import type { CanonicalMemoryStore } from "./contract";
import type { MemoryRecordDraft } from "./types";

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
  "rejected",
  "redacted"
);

const memoryScopeSchema = Schema.Literal("private", "team", "org", "session");

const recordMemoryInputSchema = effectInputSchema(
  Schema.Struct({
    id: Schema.String.annotations({
      description: "Stable memory record id, such as preference.ui.hugeicons"
    }),
    kind: memoryKindSchema,
    scope: memoryScopeSchema,
    scopeId: Schema.String.annotations({
      description:
        "Scope owner id, such as local-user, default-team, default-org, or local-session."
    }),
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
  store: CanonicalMemoryStore,
  accessContext: MemoryAccessContext = createLocalMemoryAccessContext()
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
            scope: "team",
            scopeId: findMemoryScopeId(accessContext, "team"),
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
        const result = store.search(query, accessContext);
        return {
          records: result.hits.map((hit) => ({
            id: hit.record.id,
            title: hit.record.title,
            kind: hit.record.kind,
            scope: hit.record.scope,
            scopeId: hit.record.scopeId,
            status: hit.record.status,
            body: hit.record.body,
            evidence: hit.record.evidence,
            contentHash: hit.record.contentHash,
            recordHash: hit.record.recordHash,
            score: hit.score,
            reasons: hit.reasons
          })),
          lifecycleViolations: result.lifecycleViolations,
          blockedRecordIds: result.blockedRecordIds,
          blockedRecords: result.blockedRecords,
          provenance: result.provenance
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
        const retrieval = store.search(input, accessContext);
        const route = routeTask(input, retrieval);
        const routeRecord = store.upsert(
          toRouteRecord(
            input,
            route,
            retrieval.hits.map((hit) => hit.record.id),
            findMemoryScopeId(accessContext, "session")
          )
        );
        return {
          route,
          retrievedRecordIds: retrieval.hits.map((hit) => hit.record.id),
          routeRecordId: routeRecord.id
        };
      }
    })
  };
}

function toMemoryRecord(
  input: Omit<
    MemoryRecordDraft,
    "createdAt" | "updatedAt" | "contentHash" | "recordHash"
  >
): MemoryRecordDraft {
  const now = new Date().toISOString();

  return {
    ...input,
    createdAt: now,
    updatedAt: now
  };
}

function toRouteRecord(
  input: string,
  route: RouteDecision,
  retrievedRecordIds: readonly string[],
  scopeId: string
): MemoryRecordDraft {
  const now = new Date().toISOString();
  const inputHash = hashString(input);

  return {
    id: `route.${now.replace(/[^0-9]/g, "")}.${inputHash}`,
    kind: "route_record",
    scope: "session",
    scopeId,
    status: "active",
    title: `${route.mode} route for ${truncate(input, 48)}`,
    body: JSON.stringify(
      {
        input,
        route,
        retrievedRecordIds
      },
      null,
      2
    ),
    evidence: `routeTask tool executed at ${now}`,
    rationale: route.reason,
    createdAt: now,
    updatedAt: now,
    reEvalTrigger:
      "when a user corrects the route, cost, latency, or required effort",
    consumerRules: [
      "Use for debugging and route evaluation only",
      "Do not present route records as durable product decisions"
    ],
    tags: ["routing", route.mode, route.effort, route.budget],
    supersedes: []
  };
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
