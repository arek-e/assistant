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

export type MemoryRecordKind = Schema.Schema.Type<typeof MemoryRecordKindSchema>;

const MemoryScopeSchema = Schema.Literal("private", "team", "org", "session");

export type MemoryScope = Schema.Schema.Type<typeof MemoryScopeSchema>;

const LifecycleStatusSchema = Schema.Literal(
  "draft",
  "proposed",
  "active",
  "superseded",
  "rejected",
  "redacted"
);

export type LifecycleStatus = Schema.Schema.Type<typeof LifecycleStatusSchema>;

export const MemoryRecordSchema = Schema.Struct({
  id: Schema.String,
  kind: MemoryRecordKindSchema,
  scope: MemoryScopeSchema,
  scopeId: Schema.String,
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
  supersedes: Schema.Array(Schema.String),
  contentHash: Schema.String,
  recordHash: Schema.String
});

export type MemoryRecord = Schema.Schema.Type<typeof MemoryRecordSchema>;

export type MemoryRecordDraft = Omit<MemoryRecord, "contentHash" | "recordHash"> & {
  contentHash?: string;
  recordHash?: string;
};

export function decodeMemoryRecord(record: unknown): MemoryRecord {
  const result = Schema.decodeUnknownEither(MemoryRecordSchema)(record);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}

export function decodeLifecycleStatus(status: unknown): LifecycleStatus {
  const result = Schema.decodeUnknownEither(LifecycleStatusSchema)(status);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}
