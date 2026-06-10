import { Schema } from "effect";

import {
  MemoryRecordSchema,
  type MemoryRecord,
  type MemoryWriteDecision,
  type MemoryWriteKind,
  type MemoryWriteStatus,
  type RouteBudget,
  type RouteDecision,
  type RouteEffort,
  type RouteMode
} from "@teampitch/worker/server/assistant-primitives";

const EvalCategorySchema = Schema.Literal(
  "retrieval",
  "memory_write",
  "lifecycle",
  "routing",
  "integration"
);

export type EvalCategory = Schema.Schema.Type<typeof EvalCategorySchema>;

const RouteModeSchema: Schema.Schema<RouteMode> = Schema.Literal(
  "none",
  "direct",
  "agent",
  "sub_agent",
  "workflow"
);

const RouteEffortSchema: Schema.Schema<RouteEffort> = Schema.Literal(
  "none",
  "low",
  "medium",
  "high"
);

const RouteBudgetSchema: Schema.Schema<RouteBudget> = Schema.Literal(
  "none",
  "small",
  "standard",
  "extended"
);

const WorkspaceFileSchema = Schema.Struct({
  path: Schema.String,
  body: Schema.String
});

const ExpectedWriteKindSchema: Schema.Schema<MemoryWriteKind> = Schema.Literal(
  "none",
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

const ExpectedWriteStatusSchema: Schema.Schema<MemoryWriteStatus> = Schema.Literal(
  "none",
  "draft",
  "proposed",
  "active",
  "superseded",
  "rejected",
  "redacted"
);

export const EvalFixtureSchema = Schema.Struct({
  id: Schema.String,
  category: EvalCategorySchema,
  seedRecords: Schema.Array(MemoryRecordSchema),
  workspaceFiles: Schema.Array(WorkspaceFileSchema),
  input: Schema.String,
  expectedRecordIds: Schema.Array(Schema.String),
  forbiddenRecordIds: Schema.Array(Schema.String),
  expectedBlockedRecordIds: Schema.Array(Schema.String),
  expectedToolCalls: Schema.Array(Schema.String),
  forbiddenToolCalls: Schema.Array(Schema.String),
  expectedWriteKind: ExpectedWriteKindSchema,
  expectedWriteStatus: ExpectedWriteStatusSchema,
  promotionRecordId: Schema.String,
  promotionStatus: ExpectedWriteStatusSchema,
  expectedPromotedStatus: ExpectedWriteStatusSchema,
  expectedRouteMode: RouteModeSchema,
  expectedRouteEffort: RouteEffortSchema,
  expectedRouteBudget: RouteBudgetSchema,
  expectedBehavior: Schema.String,
  metrics: Schema.Array(Schema.String),
  notes: Schema.String
});

export type EvalFixture = Schema.Schema.Type<typeof EvalFixtureSchema>;

export interface EvalCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface EvalResult {
  id: string;
  category: EvalCategory;
  passed: boolean;
  checks: EvalCheck[];
  retrievedRecordIds: string[];
  blockedRecordIds: string[];
  writeDecision: MemoryWriteDecision;
  routeDecision: RouteDecision;
  durationMs: number;
}

export type { MemoryRecord, MemoryWriteDecision, RouteDecision };
