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

export type MemoryRecordKind = Schema.Schema.Type<
  typeof MemoryRecordKindSchema
>;

const MemoryScopeSchema = Schema.Literal("user", "project", "repo", "session");

export const LifecycleStatusSchema = Schema.Literal(
  "draft",
  "proposed",
  "active",
  "superseded",
  "rejected"
);

export type LifecycleStatus = Schema.Schema.Type<typeof LifecycleStatusSchema>;

export const MemoryRecordSchema = Schema.Struct({
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
