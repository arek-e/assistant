import type { EvalFixture, MemoryRecord } from "./types";

const NOW = "2026-06-10T00:00:00.000Z";

type RecordInput = {
  id: string;
  kind: MemoryRecord["kind"];
  title: string;
  body: string;
  status?: MemoryRecord["status"];
  scope?: MemoryRecord["scope"];
  evidence?: string;
  rationale?: string;
  reEvalTrigger?: string;
  consumerRules?: string[];
  tags?: string[];
  supersedes?: string[];
};

type FixtureInput = {
  id: string;
  category: EvalFixture["category"];
  seedRecords?: MemoryRecord[];
  input: string;
  expectedRecordIds?: string[];
  forbiddenRecordIds?: string[];
  expectedWriteKind?: EvalFixture["expectedWriteKind"];
  expectedWriteStatus?: EvalFixture["expectedWriteStatus"];
  promotionRecordId?: string;
  promotionStatus?: EvalFixture["promotionStatus"];
  expectedPromotedStatus?: EvalFixture["expectedPromotedStatus"];
  expectedRouteMode?: EvalFixture["expectedRouteMode"];
  expectedRouteEffort?: EvalFixture["expectedRouteEffort"];
  expectedRouteBudget?: EvalFixture["expectedRouteBudget"];
  expectedBehavior: string;
  metrics: string[];
  notes?: string;
};

const recordDefaults = {
  scope: "project",
  status: "active",
  evidence: "seeded eval fixture",
  rationale: "fixture record for deterministic evals",
  reEvalTrigger: "when this fixture changes",
  consumerRules: ["use only when status is active"],
  tags: [],
  supersedes: []
} satisfies Pick<
  MemoryRecord,
  | "scope"
  | "status"
  | "evidence"
  | "rationale"
  | "reEvalTrigger"
  | "consumerRules"
  | "tags"
  | "supersedes"
>;

const fixtureDefaults = {
  seedRecords: [],
  workspaceFiles: [],
  expectedRecordIds: [],
  forbiddenRecordIds: [],
  expectedToolCalls: [],
  forbiddenToolCalls: [],
  expectedWriteKind: "none",
  expectedWriteStatus: "none",
  promotionRecordId: "",
  promotionStatus: "none",
  expectedPromotedStatus: "none",
  expectedRouteMode: "none",
  expectedRouteEffort: "none",
  expectedRouteBudget: "none",
  notes: ""
} satisfies Pick<
  EvalFixture,
  | "seedRecords"
  | "workspaceFiles"
  | "expectedRecordIds"
  | "forbiddenRecordIds"
  | "expectedToolCalls"
  | "forbiddenToolCalls"
  | "expectedWriteKind"
  | "expectedWriteStatus"
  | "promotionRecordId"
  | "promotionStatus"
  | "expectedPromotedStatus"
  | "expectedRouteMode"
  | "expectedRouteEffort"
  | "expectedRouteBudget"
  | "notes"
>;

function record(input: RecordInput): MemoryRecord {
  return {
    ...recordDefaults,
    ...input,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function fixture(input: FixtureInput): EvalFixture {
  return {
    ...fixtureDefaults,
    ...input
  };
}

const bunDecision = record({
  id: "decision.package-manager.bun",
  kind: "decision_record",
  title: "Use Bun as package manager",
  body: "The assistant project uses Bun for package management, scripts, and eval execution. npm create was only used to scaffold the Cloudflare starter.",
  tags: ["bun", "package", "package-manager", "runner", "scripts"]
});

const rejectedNpmDecision = record({
  id: "decision.package-manager.npm",
  kind: "decision_record",
  status: "rejected",
  title: "Use npm as package manager",
  body: "Rejected alternative. The project should not switch back to npm for normal package and script execution.",
  tags: ["npm", "package", "package-manager", "runner", "scripts"]
});

const routingDebugDrawer = record({
  id: "term.routing-debug-drawer",
  kind: "term_record",
  title: "Routing Debug Drawer",
  body: "A developer-facing drawer or popover that exposes the hidden router UI and Routing Audit Trail for debugging Effort Router decisions.",
  tags: ["hidden", "router", "routing", "ui", "debug", "drawer", "audit"]
});

const routingAuditTrail = record({
  id: "term.routing-audit-trail",
  kind: "term_record",
  title: "Routing Audit Trail",
  body: "The inspectable history of Effort Router choices, costs, latency, corrections, and route regret.",
  tags: ["hidden", "router", "routing", "audit", "debug", "trace"]
});

const oldIconPreference = record({
  id: "preference.icons.lucide",
  kind: "preference_record",
  status: "superseded",
  title: "Use lucide-react icons",
  body: "Superseded icon preference from the original starter. It is no longer the current icon set.",
  tags: ["icons", "ui", "lucide", "current"]
});

const currentIconPreference = record({
  id: "preference.icons.hugeicons",
  kind: "preference_record",
  title: "Use HugeIcons",
  body: "The current UI icon set is HugeIcons. Replace lucide icons with HugeIcons when touching assistant UI.",
  tags: ["icons", "ui", "hugeicons", "current"],
  supersedes: ["preference.icons.lucide"]
});

const rejectedVectorFirst = record({
  id: "decision.memory.vector-first",
  kind: "decision_record",
  status: "rejected",
  title: "Use vector-first memory",
  body: "Rejected alternative. Vector memory should not be the canonical source of truth for durable records.",
  tags: ["vector", "vectorize", "memory", "retrieval", "canonical"]
});

const sqliteFtsDecision = record({
  id: "decision.memory.sqlite-fts5",
  kind: "decision_record",
  title: "Start with SQLite and FTS5 retrieval",
  body: "The Canonical Memory Store starts with Durable Object SQLite and FTS5. Vectorize is deferred until retrieval evals prove semantic recall is missing.",
  tags: [
    "sqlite",
    "fts5",
    "vector",
    "vectorize",
    "memory",
    "retrieval",
    "canonical"
  ]
});

const proposedThinkDecision = record({
  id: "decision.think.prototype",
  kind: "decision_record",
  status: "proposed",
  title: "Prototype on Cloudflare Think first",
  body: "The Think prototype decision starts as proposed and should only become active after implementation evidence exists.",
  tags: ["think", "prototype", "cloudflare", "lifecycle"]
});

const evalsPackageDecision = record({
  id: "decision.evals.package",
  kind: "decision_record",
  title: "Keep assistant evals outside the Worker app",
  body: "Assistant primitive evals live in packages/evals as a workspace package. Worker-specific unit tests stay in apps/worker, but memory, retrieval, routing, and lifecycle evals are product-quality infrastructure outside the deployable Worker app.",
  tags: ["evals", "package", "packages", "worker", "workspace", "routing"]
});

export const fixtures: EvalFixture[] = [
  fixture({
    id: "retrieval.exact-package-runner",
    category: "retrieval",
    seedRecords: [bunDecision, rejectedNpmDecision],
    input: "what package runner did we choose?",
    expectedRecordIds: ["decision.package-manager.bun"],
    forbiddenRecordIds: ["decision.package-manager.npm"],
    expectedBehavior:
      "Retrieve the active Bun decision and do not expose the rejected npm alternative as current truth.",
    metrics: [
      "retrieval_recall_at_5",
      "retrieval_precision_at_5",
      "forbidden_record_hits"
    ]
  }),
  fixture({
    id: "retrieval.hidden-router-ui",
    category: "retrieval",
    seedRecords: [routingDebugDrawer, routingAuditTrail],
    input: "what did we mean by the hidden router UI?",
    expectedRecordIds: [
      "term.routing-debug-drawer",
      "term.routing-audit-trail"
    ],
    expectedBehavior:
      "Retrieve the debug drawer and audit trail terms for the hidden routing UI.",
    metrics: ["retrieval_recall_at_5", "retrieval_precision_at_5"]
  }),
  fixture({
    id: "retrieval.lifecycle-current-icon-set",
    category: "retrieval",
    seedRecords: [oldIconPreference, currentIconPreference],
    input: "which icon set is current?",
    expectedRecordIds: ["preference.icons.hugeicons"],
    forbiddenRecordIds: ["preference.icons.lucide"],
    expectedBehavior:
      "Prefer the active HugeIcons preference and keep the superseded lucide preference out of returned evidence.",
    metrics: [
      "retrieval_recall_at_5",
      "forbidden_record_hits",
      "lifecycle_violations"
    ]
  }),
  fixture({
    id: "retrieval.rejected-vector-first",
    category: "retrieval",
    seedRecords: [rejectedVectorFirst, sqliteFtsDecision],
    input: "are we starting with vector memory?",
    expectedRecordIds: ["decision.memory.sqlite-fts5"],
    forbiddenRecordIds: ["decision.memory.vector-first"],
    expectedBehavior:
      "Retrieve the SQLite + FTS5 decision and do not treat vector-first memory as accepted.",
    metrics: [
      "retrieval_recall_at_5",
      "forbidden_record_hits",
      "lifecycle_violations"
    ]
  }),
  fixture({
    id: "retrieval.evals-package-boundary",
    category: "retrieval",
    seedRecords: [evalsPackageDecision],
    input: "should assistant evals live inside the worker app?",
    expectedRecordIds: ["decision.evals.package"],
    expectedBehavior:
      "Retrieve the package-boundary decision that keeps assistant primitive evals outside the deployable Worker app.",
    metrics: ["retrieval_recall_at_5", "retrieval_precision_at_5"]
  }),
  fixture({
    id: "retrieval.negative-no-memory",
    category: "retrieval",
    seedRecords: [routingDebugDrawer, sqliteFtsDecision],
    input: "what is my preferred coffee grinder?",
    expectedRecordIds: [],
    forbiddenRecordIds: [
      "term.routing-debug-drawer",
      "decision.memory.sqlite-fts5"
    ],
    expectedBehavior:
      "Return no memory evidence when no durable record exists for the request.",
    metrics: ["retrieval_precision_at_5", "unsupported_answer_count"]
  }),
  fixture({
    id: "memory-write.transient-fragment",
    category: "memory_write",
    input: "nice thanks",
    expectedWriteKind: "none",
    expectedWriteStatus: "none",
    expectedBehavior:
      "Do not save a durable record for a transient low-value chat fragment.",
    metrics: ["admission_false_positive_count"]
  }),
  fixture({
    id: "memory-write.explicit-preference",
    category: "memory_write",
    input: "I prefer concise final answers unless I ask for detail.",
    expectedWriteKind: "preference_record",
    expectedWriteStatus: "active",
    expectedBehavior:
      "Write an active preference record when the user explicitly states a stable preference.",
    metrics: ["tool_call_accuracy", "memory_write_evidence_present"]
  }),
  fixture({
    id: "memory-write.proposed-decision",
    category: "memory_write",
    input:
      "We chose SQLite and FTS5 first because we need lifecycle-safe memory before Vectorize.",
    expectedWriteKind: "decision_record",
    expectedWriteStatus: "proposed",
    expectedBehavior:
      "Write a proposed decision record until implementation evidence exists.",
    metrics: ["tool_call_accuracy", "lifecycle_violations"]
  }),
  fixture({
    id: "lifecycle.promote-proposed-decision",
    category: "lifecycle",
    seedRecords: [proposedThinkDecision],
    input:
      "promote the Think prototype decision after implementation evidence exists",
    promotionRecordId: "decision.think.prototype",
    promotionStatus: "active",
    expectedPromotedStatus: "active",
    expectedBehavior:
      "Promote a proposed decision to active while preserving a validated record shape.",
    metrics: ["lifecycle_violations", "tool_call_accuracy"]
  }),
  fixture({
    id: "routing.direct-active-memory",
    category: "routing",
    seedRecords: [bunDecision],
    input: "what package runner did we choose?",
    expectedRouteMode: "direct",
    expectedRouteEffort: "low",
    expectedRouteBudget: "small",
    expectedBehavior:
      "Use a cheap direct route when active memory contains enough evidence.",
    metrics: ["route_regret_rate", "cost_per_success"]
  }),
  fixture({
    id: "routing.repo-implementation-task",
    category: "routing",
    input: "implement the memory eval runner in the repo",
    expectedRouteMode: "agent",
    expectedRouteEffort: "medium",
    expectedRouteBudget: "standard",
    expectedBehavior: "Use an agent/tool route for a repo implementation task.",
    metrics: ["route_regret_rate", "tool_call_accuracy"]
  })
];
