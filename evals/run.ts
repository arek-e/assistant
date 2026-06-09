import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";
import { fixtures } from "./fixtures";
import { proposeMemoryWrite, retrieveRecords, routeTask } from "./primitives";
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

function validateFixture(fixture: unknown): EvalFixture {
  const result = Schema.decodeUnknownEither(EvalFixtureSchema)(fixture);

  if (result._tag === "Right") {
    return result.right;
  }

  throw new Error(result.left.message);
}

function evaluateFixture(fixture: EvalFixture): EvalResult {
  const startedAt = Date.now();
  const retrievalResult = retrieveRecords(fixture.seedRecords, fixture.input);
  const retrievedRecordIds = retrievalResult.hits.map((hit) => hit.record.id);
  const categoryEvaluation = evaluateCategory(
    fixture,
    retrievalResult,
    retrievedRecordIds
  );
  const checks = categoryEvaluation.checks;

  return {
    id: fixture.id,
    category: fixture.category,
    passed: checks.every((check) => check.passed),
    checks,
    retrievedRecordIds,
    writeDecision: categoryEvaluation.writeDecision,
    routeDecision: categoryEvaluation.routeDecision,
    durationMs: Date.now() - startedAt
  };
}

function evaluateCategory(
  fixture: EvalFixture,
  retrievalResult: ReturnType<typeof retrieveRecords>,
  retrievedRecordIds: readonly string[]
): CategoryEvaluation {
  if (fixture.category === "retrieval") {
    return evaluateRetrievalFixture(
      fixture,
      retrievalResult,
      retrievedRecordIds
    );
  }

  if (fixture.category === "memory_write") {
    return evaluateMemoryWriteFixture(fixture);
  }

  if (fixture.category === "routing") {
    return evaluateRoutingFixture(fixture, retrievalResult);
  }

  return noCategoryEvaluation();
}

function evaluateRetrievalFixture(
  fixture: EvalFixture,
  retrievalResult: ReturnType<typeof retrieveRecords>,
  retrievedRecordIds: readonly string[]
): CategoryEvaluation {
  const checks = [
    expectEveryRecord(
      "expected records retrieved",
      fixture.expectedRecordIds,
      retrievedRecordIds
    ),
    expectNoRecords(
      "forbidden records absent",
      fixture.forbiddenRecordIds,
      retrievedRecordIds
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
  retrievalResult: ReturnType<typeof retrieveRecords>
): CategoryEvaluation {
  const routeDecision = routeTask(fixture.input, retrievalResult);

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
      }
    ],
    writeDecision: emptyWriteDecision,
    routeDecision
  };
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

function negativeRetrievalCheck(
  retrievedRecordIds: readonly string[]
): EvalCheck {
  return {
    name: "negative retrieval stays empty",
    passed: retrievedRecordIds.length === 0,
    detail:
      retrievedRecordIds.length === 0
        ? "no memory evidence returned"
        : `unexpected records: ${retrievedRecordIds.join(", ")}`
  };
}

function writeAdmissionCheck(
  fixture: EvalFixture,
  writeDecision: MemoryWriteDecision
): EvalCheck {
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
  const missing = expectedRecordIds.filter(
    (recordId) => !actualRecordIds.includes(recordId)
  );

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
  const found = forbiddenRecordIds.filter((recordId) =>
    actualRecordIds.includes(recordId)
  );

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
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
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

  console.log(
    `Assistant primitive evals: ${passedCount}/${results.length} passed`
  );

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
