import { tool, type ToolSet } from "ai";
import { Schema } from "effect";

import { effectInputSchema } from "@/server/effect-schema";
import { routeTask, type RouteDecision } from "@/server/routing/effort-router";

import {
  canAccessMemoryRecord,
  canUseMemoryScope,
  createLocalMemoryAccessContext,
  findMemoryScopeGrant,
  findMemoryScopeId,
  toMemoryRecordActor,
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

type MemoryAccessContextProvider =
  | MemoryAccessContext
  | (() => MemoryAccessContext | Promise<MemoryAccessContext>);

export function createMemoryPrimitiveTools(
  store: CanonicalMemoryStore,
  accessContextProvider: MemoryAccessContextProvider = createLocalMemoryAccessContext()
): ToolSet {
  return {
    recordMemory: tool({
      description:
        "Save a typed durable memory record with evidence, lifecycle status, and consumer rules.",
      inputSchema: recordMemoryInputSchema,
      execute: async (input) => {
        const accessContext = await resolveAccessContext(accessContextProvider);
        const denied = denyInaccessibleWrite(input.scope, input.scopeId, accessContext);
        if (denied) return denied;

        const record = store.upsert(toMemoryRecord(input, accessContext));
        return { saved: true, record };
      }
    }),

    recordDecision: tool({
      description:
        "Save a proposed or active decision with rationale, alternatives, and a re-evaluation trigger.",
      inputSchema: recordDecisionInputSchema,
      execute: async (input) => {
        const accessContext = await resolveAccessContext(accessContextProvider);
        const teamGrant = findMemoryScopeGrant(accessContext, "team");
        if (!teamGrant) {
          return denyMissingScope("team", accessContext);
        }

        const record = store.upsert(
          toMemoryRecord(
            {
              id: input.id,
              kind: "decision_record",
              scope: "team",
              scopeId: teamGrant.scopeId,
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
            },
            accessContext
          )
        );
        return { saved: true, record };
      }
    }),

    searchMemory: tool({
      description:
        "Search durable assistant memory. Use before answering questions about project decisions, preferences, terms, or prior choices.",
      inputSchema: searchMemoryInputSchema,
      execute: async ({ query }) => {
        const accessContext = await resolveAccessContext(accessContextProvider);
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
        const accessContext = await resolveAccessContext(accessContextProvider);
        const existingRecord = store.list().find((candidate) => candidate.id === recordId);

        if (existingRecord && !canAccessMemoryRecord(existingRecord, accessContext)) {
          return {
            promoted: false,
            error: `Access denied for memory record ${recordId}`,
            identity: summarizeIdentity(accessContext)
          };
        }

        const record = store.promote(recordId, status, accessContext);
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
        const accessContext = await resolveAccessContext(accessContextProvider);
        const retrieval = store.search(input, accessContext);
        const route = routeTask(input, retrieval);
        const routeRecord = store.upsert(
          toRouteRecord(
            input,
            route,
            retrieval.hits.map((hit) => hit.record.id),
            findMemoryScopeId(accessContext, "session"),
            accessContext
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
    "actor" | "createdAt" | "updatedAt" | "contentHash" | "recordHash"
  >,
  accessContext: MemoryAccessContext
): MemoryRecordDraft {
  const now = new Date().toISOString();

  return {
    ...input,
    actor: toMemoryRecordActor(accessContext),
    createdAt: now,
    updatedAt: now
  };
}

function toRouteRecord(
  input: string,
  route: RouteDecision,
  retrievedRecordIds: readonly string[],
  scopeId: string,
  accessContext: MemoryAccessContext
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
        actor: summarizeIdentity(accessContext),
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
    reEvalTrigger: "when a user corrects the route, cost, latency, or required effort",
    consumerRules: [
      "Use for debugging and route evaluation only",
      "Do not present route records as durable product decisions"
    ],
    tags: ["routing", route.mode, route.effort, route.budget],
    actor: toMemoryRecordActor(accessContext),
    supersedes: []
  };
}

async function resolveAccessContext(
  provider: MemoryAccessContextProvider
): Promise<MemoryAccessContext> {
  return typeof provider === "function" ? await provider() : provider;
}

function denyInaccessibleWrite(
  scope: MemoryRecordDraft["scope"],
  scopeId: string,
  accessContext: MemoryAccessContext
) {
  if (canUseMemoryScope(scope, scopeId, accessContext)) return null;

  return {
    saved: false,
    error: `Access denied for memory scope ${scope}:${scopeId}`,
    identity: summarizeIdentity(accessContext)
  };
}

function denyMissingScope(scope: MemoryRecordDraft["scope"], accessContext: MemoryAccessContext) {
  return {
    saved: false,
    error: `No ${scope} memory grant is available for this actor`,
    identity: summarizeIdentity(accessContext)
  };
}

function summarizeIdentity(accessContext: MemoryAccessContext) {
  return {
    subjectId: accessContext.subjectId,
    subjectType: accessContext.subjectType,
    provider: accessContext.provider,
    grants: accessContext.grants
  };
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
