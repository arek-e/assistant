import { Schema } from "effect";

const MemoryRecordKindSchema = Schema.Literal(
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

const MemoryScopeSchema = Schema.Literal("user", "project", "repo", "session");

const LifecycleStatusSchema = Schema.Literal(
  "draft",
  "proposed",
  "active",
  "superseded",
  "rejected"
);

const MemoryRecordSchema = Schema.Struct({
  id: Schema.String,
  kind: MemoryRecordKindSchema,
  scope: MemoryScopeSchema,
  status: LifecycleStatusSchema,
  title: Schema.String,
  body: Schema.String,
  evidence: Schema.String,
  rationale: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  reEvalTrigger: Schema.String,
  consumerRules: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
  supersedes: Schema.Array(Schema.String)
});

export type MemoryRecord = Schema.Schema.Type<typeof MemoryRecordSchema>;

const EvalCategorySchema = Schema.Literal(
  "retrieval",
  "memory_write",
  "routing",
  "integration"
);

export type EvalCategory = Schema.Schema.Type<typeof EvalCategorySchema>;

const RouteModeSchema = Schema.Literal(
  "none",
  "direct",
  "agent",
  "sub_agent",
  "workflow"
);

export type RouteMode = Schema.Schema.Type<typeof RouteModeSchema>;

const RouteEffortSchema = Schema.Literal("none", "low", "medium", "high");

export type RouteEffort = Schema.Schema.Type<typeof RouteEffortSchema>;

const RouteBudgetSchema = Schema.Literal(
  "none",
  "small",
  "standard",
  "extended"
);

export type RouteBudget = Schema.Schema.Type<typeof RouteBudgetSchema>;

const WorkspaceFileSchema = Schema.Struct({
  path: Schema.String,
  body: Schema.String
});

const ExpectedWriteKindSchema = Schema.Literal(
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

export type ExpectedWriteKind = Schema.Schema.Type<
  typeof ExpectedWriteKindSchema
>;

const ExpectedWriteStatusSchema = Schema.Literal(
  "none",
  "draft",
  "proposed",
  "active",
  "superseded",
  "rejected"
);

export type ExpectedWriteStatus = Schema.Schema.Type<
  typeof ExpectedWriteStatusSchema
>;

export const EvalFixtureSchema = Schema.Struct({
  id: Schema.String,
  category: EvalCategorySchema,
  seedRecords: Schema.Array(MemoryRecordSchema),
  workspaceFiles: Schema.Array(WorkspaceFileSchema),
  input: Schema.String,
  expectedRecordIds: Schema.Array(Schema.String),
  forbiddenRecordIds: Schema.Array(Schema.String),
  expectedToolCalls: Schema.Array(Schema.String),
  forbiddenToolCalls: Schema.Array(Schema.String),
  expectedWriteKind: ExpectedWriteKindSchema,
  expectedWriteStatus: ExpectedWriteStatusSchema,
  expectedRouteMode: RouteModeSchema,
  expectedRouteEffort: RouteEffortSchema,
  expectedRouteBudget: RouteBudgetSchema,
  expectedBehavior: Schema.String,
  metrics: Schema.Array(Schema.String),
  notes: Schema.String
});

export type EvalFixture = Schema.Schema.Type<typeof EvalFixtureSchema>;

export interface RetrievalHit {
  record: MemoryRecord;
  score: number;
  reasons: string[];
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  lifecycleViolations: string[];
}

export interface MemoryWriteDecision {
  shouldWrite: boolean;
  kind: ExpectedWriteKind;
  status: ExpectedWriteStatus;
  reason: string;
  hasEvidence: boolean;
}

export interface RouteDecision {
  mode: RouteMode;
  effort: RouteEffort;
  budget: RouteBudget;
  requiresApproval: boolean;
  reason: string;
}

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
  writeDecision: MemoryWriteDecision;
  routeDecision: RouteDecision;
  durationMs: number;
}
