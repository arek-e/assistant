import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";

import {
  type CanonicalMemoryStore,
  createRouteRecordDraft,
  createLocalMemoryAccessContext,
  proposeMemoryWrite,
  routeTask,
  SqliteCanonicalMemoryStore,
  type MemoryAccessContext,
  type MemoryRecord,
  type RetrievalResult
} from "@teampitch/worker/server/assistant-primitives";

import { createEvalMemorySqlStorage } from "./bun-sqlite-memory";
import { fixtures } from "./fixtures";
import {
  EvalFixtureSchema,
  type EvalCheck,
  type EvalFixture,
  type EvalResult,
  type MemoryWriteDecision,
  type RouteDecision
} from "./types";

const emptyWriteDecision: MemoryWriteDecision = {
  shouldWrite: false,
  kind: "none",
  status: "none",
  reason: "not evaluated for this fixture category",
  hasEvidence: false
};

const emptyRouteDecision: RouteDecision = {
  mode: "none",
  effort: "none",
  budget: "none",
  requiresApproval: false,
  reason: "not evaluated for this fixture category"
};

interface CategoryEvaluation {
  checks: EvalCheck[];
  writeDecision: MemoryWriteDecision;
  routeDecision: RouteDecision;
}

interface EvaluationContext {
  accessContext: MemoryAccessContext;
  fixture: EvalFixture;
  memoryStore: CanonicalMemoryStore;
  retrievalResult: RetrievalResult;
  retrievedRecordIds: readonly string[];
}

type CategoryEvaluator = (context: EvaluationContext) => CategoryEvaluation;

const CATEGORY_EVALUATORS = {
  retrieval: ({ fixture, retrievalResult, retrievedRecordIds }) =>
    evaluateRetrievalFixture(fixture, retrievalResult, retrievedRecordIds),
  memory_write: ({ fixture }) => evaluateMemoryWriteFixture(fixture),
  lifecycle: ({ fixture, memoryStore }) => evaluateLifecycleFixture(fixture, memoryStore),
  routing: ({ accessContext, fixture, memoryStore, retrievalResult }) =>
    evaluateRoutingFixture(fixture, retrievalResult, memoryStore, accessContext),
  integration: () => noCategoryEvaluation()
} satisfies Record<EvalFixture["category"], CategoryEvaluator>;

function validateFixture(fixture: unknown): EvalFixture {
  const result = Schema.decodeUnknownEither(EvalFixtureSchema)(fixture);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}

function evaluateFixture(fixture: EvalFixture): EvalResult {
  const startedAt = Date.now();
  const memoryStore = createMemoryStore(fixture);
  const accessContext = fixture.accessContext ?? createLocalMemoryAccessContext();
  const retrievalResult = memoryStore.search(fixture.input, accessContext);
  const retrievedRecordIds = retrievalResult.hits.map((hit) => hit.record.id);
  const categoryEvaluation = evaluateCategory(
    accessContext,
    fixture,
    memoryStore,
    retrievalResult,
    retrievedRecordIds
  );
  const checks = [
    ...categoryEvaluation.checks,
    ...attributionChecks(fixture, accessContext, retrievalResult)
  ];

  return {
    id: fixture.id,
    category: fixture.category,
    passed: checks.every((check) => check.passed),
    checks,
    retrievedRecordIds,
    blockedRecordIds: retrievalResult.blockedRecordIds,
    writeDecision: categoryEvaluation.writeDecision,
    routeDecision: categoryEvaluation.routeDecision,
    durationMs: Date.now() - startedAt
  };
}

function attributionChecks(
  fixture: EvalFixture,
  accessContext: MemoryAccessContext,
  retrievalResult: RetrievalResult
): EvalCheck[] {
  if (!fixture.expectedActorDisplayName) return [];

  return [
    {
      name: "expected actor display name",
      passed: accessContext.displayName === fixture.expectedActorDisplayName,
      detail: `expected ${fixture.expectedActorDisplayName}, got ${accessContext.displayName}`
    },
    {
      name: "expected provenance actor",
      passed: retrievalResult.provenance.displayName === fixture.expectedActorDisplayName,
      detail: `expected ${fixture.expectedActorDisplayName}, got ${retrievalResult.provenance.displayName}`
    }
  ];
}

function createMemoryStore(fixture: EvalFixture): CanonicalMemoryStore {
  const memoryStore = new SqliteCanonicalMemoryStore(createEvalMemorySqlStorage());
  memoryStore.seed(fixture.seedRecords);
  return memoryStore;
}

function evaluateCategory(
  accessContext: MemoryAccessContext,
  fixture: EvalFixture,
  memoryStore: CanonicalMemoryStore,
  retrievalResult: RetrievalResult,
  retrievedRecordIds: readonly string[]
): CategoryEvaluation {
  return CATEGORY_EVALUATORS[fixture.category]({
    accessContext,
    fixture,
    memoryStore,
    retrievalResult,
    retrievedRecordIds
  });
}

function evaluateLifecycleFixture(
  fixture: EvalFixture,
  memoryStore: CanonicalMemoryStore
): CategoryEvaluation {
  const promotedRecord = promoteFixtureRecord(fixture, memoryStore);

  return {
    checks: [
      recordPromotedCheck(fixture, promotedRecord),
      promotedStatusCheck(fixture, promotedRecord)
    ],
    writeDecision: emptyWriteDecision,
    routeDecision: emptyRouteDecision
  };
}

function promoteFixtureRecord(fixture: EvalFixture, memoryStore: CanonicalMemoryStore) {
  if (fixture.promotionStatus === "none") return null;
  return memoryStore.promote(fixture.promotionRecordId, fixture.promotionStatus);
}

function recordPromotedCheck(fixture: EvalFixture, promotedRecord: MemoryRecord | null): EvalCheck {
  return {
    name: "record promoted",
    passed: promotedRecord !== null,
    detail: promotedRecord
      ? `promoted ${promotedRecord.id}`
      : `missing record ${fixture.promotionRecordId}`
  };
}

function promotedStatusCheck(fixture: EvalFixture, promotedRecord: MemoryRecord | null): EvalCheck {
  return {
    name: "expected promoted status",
    passed: promotedRecord?.status === fixture.expectedPromotedStatus,
    detail: `expected ${fixture.expectedPromotedStatus}, got ${promotedRecord?.status ?? "none"}`
  };
}

function evaluateRetrievalFixture(
  fixture: EvalFixture,
  retrievalResult: RetrievalResult,
  retrievedRecordIds: readonly string[]
): CategoryEvaluation {
  const checks = [
    expectEveryRecord("expected records retrieved", fixture.expectedRecordIds, retrievedRecordIds),
    expectNoRecords("forbidden records absent", fixture.forbiddenRecordIds, retrievedRecordIds),
    expectEveryRecord(
      "expected records blocked",
      fixture.expectedBlockedRecordIds,
      retrievalResult.blockedRecordIds
    ),
    lifecycleCheck(retrievalResult.lifecycleViolations)
  ];

  if (fixture.expectedRecordIds.length === 0) {
    checks.push(negativeRetrievalCheck(retrievedRecordIds));
  }

  return {
    checks,
    writeDecision: emptyWriteDecision,
    routeDecision: emptyRouteDecision
  };
}

function evaluateMemoryWriteFixture(fixture: EvalFixture): CategoryEvaluation {
  const writeDecision = proposeMemoryWrite(fixture.input);

  return {
    checks: [
      {
        name: "expected write kind",
        passed: writeDecision.kind === fixture.expectedWriteKind,
        detail: `expected ${fixture.expectedWriteKind}, got ${writeDecision.kind}`
      },
      {
        name: "expected write status",
        passed: writeDecision.status === fixture.expectedWriteStatus,
        detail: `expected ${fixture.expectedWriteStatus}, got ${writeDecision.status}`
      },
      writeAdmissionCheck(fixture, writeDecision)
    ],
    writeDecision,
    routeDecision: emptyRouteDecision
  };
}

function evaluateRoutingFixture(
  fixture: EvalFixture,
  retrievalResult: RetrievalResult,
  memoryStore: CanonicalMemoryStore,
  accessContext: MemoryAccessContext
): CategoryEvaluation {
  const routeDecision = routeTask(fixture.input, retrievalResult);
  const routeRecord = memoryStore.upsert(
    createRouteRecordDraft(
      fixture.input,
      routeDecision,
      retrievalResult.hits.map((hit) => hit.record.id),
      sessionScopeId(accessContext),
      accessContext
    )
  );

  return {
    checks: [
      {
        name: "expected route mode",
        passed: routeDecision.mode === fixture.expectedRouteMode,
        detail: `expected ${fixture.expectedRouteMode}, got ${routeDecision.mode}`
      },
      {
        name: "expected route effort",
        passed: routeDecision.effort === fixture.expectedRouteEffort,
        detail: `expected ${fixture.expectedRouteEffort}, got ${routeDecision.effort}`
      },
      {
        name: "expected route budget",
        passed: routeDecision.budget === fixture.expectedRouteBudget,
        detail: `expected ${fixture.expectedRouteBudget}, got ${routeDecision.budget}`
      },
      ...routeRecordAttributionChecks(fixture, routeRecord)
    ],
    writeDecision: emptyWriteDecision,
    routeDecision
  };
}

function routeRecordAttributionChecks(
  fixture: EvalFixture,
  routeRecord: MemoryRecord
): EvalCheck[] {
  if (!fixture.expectedActorDisplayName) return [];

  return [
    {
      name: "expected route record actor",
      passed: routeRecord.actor.displayName === fixture.expectedActorDisplayName,
      detail: `expected ${fixture.expectedActorDisplayName}, got ${routeRecord.actor.displayName}`
    }
  ];
}

function sessionScopeId(accessContext: MemoryAccessContext): string {
  return (
    accessContext.grants.find((grant) => grant.scope === "session")?.scopeId ??
    accessContext.sessionId
  );
}

function noCategoryEvaluation(): CategoryEvaluation {
  return {
    checks: [],
    writeDecision: emptyWriteDecision,
    routeDecision: emptyRouteDecision
  };
}

function lifecycleCheck(lifecycleViolations: readonly string[]): EvalCheck {
  return {
    name: "lifecycle violations absent",
    passed: lifecycleViolations.length === 0,
    detail:
      lifecycleViolations.length === 0
        ? "no rejected or superseded records were returned"
        : `returned blocked records: ${lifecycleViolations.join(", ")}`
  };
}

function negativeRetrievalCheck(retrievedRecordIds: readonly string[]): EvalCheck {
  return {
    name: "negative retrieval stays empty",
    passed: retrievedRecordIds.length === 0,
    detail:
      retrievedRecordIds.length === 0
        ? "no memory evidence returned"
        : `unexpected records: ${retrievedRecordIds.join(", ")}`
  };
}

function writeAdmissionCheck(fixture: EvalFixture, writeDecision: MemoryWriteDecision): EvalCheck {
  if (fixture.expectedWriteKind === "none") {
    return {
      name: "admission rejects low-value input",
      passed: !writeDecision.shouldWrite,
      detail: writeDecision.reason
    };
  }

  return {
    name: "write includes evidence",
    passed: writeDecision.hasEvidence,
    detail: writeDecision.hasEvidence
      ? "write decision has evidence"
      : "write decision is missing evidence"
  };
}

function expectEveryRecord(
  name: string,
  expectedRecordIds: readonly string[],
  actualRecordIds: readonly string[]
): EvalCheck {
  const missing = expectedRecordIds.filter((recordId) => !actualRecordIds.includes(recordId));

  return {
    name,
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `found expected records: ${expectedRecordIds.join(", ") || "none"}`
        : `missing expected records: ${missing.join(", ")}`
  };
}

function expectNoRecords(
  name: string,
  forbiddenRecordIds: readonly string[],
  actualRecordIds: readonly string[]
): EvalCheck {
  const found = forbiddenRecordIds.filter((recordId) => actualRecordIds.includes(recordId));

  return {
    name,
    passed: found.length === 0,
    detail:
      found.length === 0
        ? "no forbidden records returned"
        : `forbidden records returned: ${found.join(", ")}`
  };
}

function writeTrace(results: EvalResult[]) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const traceDir = join(repoRoot, ".evals");
  mkdirSync(traceDir, { recursive: true });
  writeFileSync(
    join(traceDir, "latest.jsonl"),
    `${results.map((result) => JSON.stringify(result)).join("\n")}\n`
  );
}

function printResults(results: EvalResult[]) {
  const passedCount = results.filter((result) => result.passed).length;
  const failedResults = results.filter((result) => !result.passed);

  console.log(`Assistant primitive evals: ${passedCount}/${results.length} passed`);

  results.forEach(printResult);

  if (failedResults.length > 0) {
    console.log(".evals/latest.jsonl contains the full trace.");
  }
}

function printResult(result: EvalResult) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id}`);
  result.checks.filter((item) => !item.passed).forEach(printFailedCheck);
}

function printFailedCheck(check: EvalCheck) {
  console.log(`  - ${check.name}: ${check.detail}`);
}

const validatedFixtures = fixtures.map(validateFixture);
const results = validatedFixtures.map(evaluateFixture);

writeTrace(results);
printResults(results);

if (results.some((result) => !result.passed)) {
  process.exitCode = 1;
}
