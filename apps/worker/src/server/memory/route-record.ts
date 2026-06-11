import type { RouteDecision } from "../routing/effort-router";
import { toMemoryRecordActor, type MemoryAccessContext } from "./access";
import { summarizeMemoryAccessContext } from "./actor-summary";
import type { MemoryRecordDraft } from "./types";

export function createRouteRecordDraft(
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
        actor: summarizeMemoryAccessContext(accessContext),
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

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function hashString(value: string) {
  let hash = 5381;
  for (const character of value) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }
  return (hash >>> 0).toString(36);
}
