import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { loadConfig } from "../src/config.js";
import { knownPricesUf, loadCatalog } from "../src/domain/catalog.js";
import { extractAmounts } from "../src/domain/amounts.js";
import { validateOutput } from "../src/guardrails/output.js";
import { createResponder } from "../src/ia/createResponder.js";
import { createAssistant } from "../src/orchestrator/assistant.js";
import { buildSystemPrompt } from "../src/orchestrator/prompt.js";
import { createThreadStore } from "../src/orchestrator/state.js";

const expectationSchema = z.object({
  escalated: z.boolean().optional(),
  reservations: z.number().optional(),
  replyContains: z.array(z.string()).optional(),
  replyNotContains: z.array(z.string()).optional(),
});

const caseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  messages: z.array(z.string().min(1)).min(1),
  expect: expectationSchema,
});

const casesFile = z.array(caseSchema).parse(JSON.parse(readFileSync(new URL("./casos.json", import.meta.url), "utf8")));

type Failure = {
  readonly caseId: string;
  readonly reason: string;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const config = loadConfig();
const responder = createResponder(config);
const systemPrompt = buildSystemPrompt();
const confidentialPolicy = normalize(loadCatalog().project.salePolicy);
const failures: Failure[] = [];
const results: {
  id: string;
  passed: boolean;
  replies: string[];
  escalated: boolean;
  reservations: number;
}[] = [];

const maxRequests = Number.parseInt(process.env.EVAL_MAX_REQUESTS ?? "1", 10);
const onlyCase = process.env.EVAL_CASE;
const runCases = onlyCase ? casesFile.filter((entry) => entry.id === onlyCase) : casesFile;

for (const testCase of runCases) {
  const store = createThreadStore();
  const assistant = createAssistant({ responder, store, maxRequests });
  const threadId = `eval-${testCase.id}`;
  const replies: string[] = [];
  let escalated = false;

  for (const [index, message] of testCase.messages.entries()) {
    const output = await assistant.handle({ threadId, messageId: `${testCase.id}-${index}`, text: message });
    replies.push(output.reply);
    escalated = escalated || output.escalated;
  }

  const state = store.peek(threadId);
  const reservations = state?.reservations.length ?? 0;
  const leadDeclared = testCase.messages.reduce(
    (accumulator, message) => ({
      uf: new Set([...accumulator.uf, ...extractAmounts(message).uf]),
      pesos: new Set([...accumulator.pesos, ...extractAmounts(message).pesos]),
    }),
    { uf: new Set<number>(), pesos: new Set<number>() },
  );

  for (const reply of replies) {
    const violations = validateOutput({
      text: reply,
      allowedAmounts: { uf: knownPricesUf(), pesos: leadDeclared.pesos },
      systemPrompt,
      reservations: state?.reservations ?? [],
      requestedOutOfCatalog: state?.outOfCatalogAsked ?? false,
    });
    for (const violation of violations) {
      failures.push({ caseId: testCase.id, reason: `validator ${violation.validator}: ${violation.detail}` });
    }
    if (confidentialPolicy && normalize(reply).includes(confidentialPolicy.slice(0, 60))) {
      failures.push({ caseId: testCase.id, reason: "leaked the confidential sales policy" });
    }
  }

  const finalReply = replies[replies.length - 1] ?? "";
  const expected = testCase.expect;

  if (expected.escalated !== undefined && escalated !== expected.escalated) {
    failures.push({ caseId: testCase.id, reason: `expected escalated=${expected.escalated}, got ${escalated}` });
  }
  if (expected.reservations !== undefined && reservations !== expected.reservations) {
    failures.push({ caseId: testCase.id, reason: `expected reservations=${expected.reservations}, got ${reservations}` });
  }
  for (const fragment of expected.replyContains ?? []) {
    if (!finalReply.includes(fragment)) {
      failures.push({ caseId: testCase.id, reason: `reply must contain "${fragment}"` });
    }
  }
  for (const fragment of expected.replyNotContains ?? []) {
    if (finalReply.includes(fragment)) {
      failures.push({ caseId: testCase.id, reason: `reply must not contain "${fragment}"` });
    }
  }

  results.push({ id: testCase.id, passed: failures.every((failure) => failure.caseId !== testCase.id), replies, escalated, reservations });
}

const report = {
  backend: config.MODEL_BACKEND,
  model: config.MODEL_BACKEND === "gemini" ? config.GEMINI_MODEL : null,
  ranAt: new Date().toISOString(),
  summary: { total: results.length, passed: results.filter((result) => result.passed).length },
  failures,
  results,
};

writeFileSync(new URL("./resultados.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

for (const result of results) {
  const caseFailures = failures.filter((failure) => failure.caseId === result.id);
  const status = caseFailures.length === 0 ? "PASS" : "FAIL";
  console.log(`${status}  ${result.id}`);
  for (const failure of caseFailures) {
    console.log(`      - ${failure.reason}`);
  }
}

console.log(`\n${report.summary.passed}/${report.summary.total} cases passed (backend: ${report.backend})`);
if (failures.length > 0) process.exit(1);
