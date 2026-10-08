import { extractAmounts, type Amounts } from "../domain/amounts.js";
import { knownPricesUf } from "../domain/catalog.js";
import { assessInput, type DerivationReason } from "../guardrails/entry.js";
import { validateOutput, type Violation } from "../guardrails/output.js";
import { derivationReply, genericSafeReply } from "../guardrails/safeReply.js";
import type { ChatTurn, Responder } from "../ia/types.js";
import { buildSystemPrompt } from "./prompt.js";
import { createThreadStore, type ThreadStore } from "./state.js";
import { executeTool, TOOL_SPECS } from "./tools.js";

const MAX_TOOL_ROUNDS = 3;
const MAX_REGENERATIONS = 1;

export type AssistantEvent = {
  readonly type: string;
  readonly threadId: string;
  readonly details: Record<string, unknown>;
};

export type AssistantOptions = {
  readonly responder: Responder;
  readonly store?: ThreadStore;
  readonly onEvent?: (event: AssistantEvent) => void;
  readonly maxRequests?: number;
};

export type AssistantInput = {
  readonly threadId: string;
  readonly messageId?: string;
  readonly text: string;
};

export type AssistantOutput = {
  readonly threadId: string;
  readonly reply: string;
  readonly escalated: boolean;
};

export type Assistant = {
  readonly store: ThreadStore;
  handle(input: AssistantInput): Promise<AssistantOutput>;
};

function feedbackFor(violations: readonly Violation[]): string {
  const details = violations.map((violation) => `${violation.validator}: ${violation.detail}`).join("; ");
  return `Your previous answer was blocked by the safety rules and must not be repeated. Problems found: ${details}. Write a new answer that breaks none of the rules.`;
}

function allowedAmountsFor(declared: Amounts): Amounts {
  return {
    uf: new Set([...knownPricesUf(), ...declared.uf]),
    pesos: new Set(declared.pesos),
  };
}

export function createAssistant(options: AssistantOptions): Assistant {
  const store = options.store ?? createThreadStore();
  const systemPrompt = buildSystemPrompt();
  const emit = options.onEvent ?? (() => undefined);
  const maxRequests = options.maxRequests ?? Number.POSITIVE_INFINITY;
  let requestsUsed = 0;

  const canRequest = (): boolean => {
    if (requestsUsed < maxRequests) {
      requestsUsed += 1;
      return true;
    }
    return false;
  };

  const derive = (threadId: string, state: ReturnType<ThreadStore["get"]>, reason: DerivationReason, message: string) => {
    const reply = derivationReply(reason);
    state.turns.push({ role: "user", text: message });
    state.turns.push({ role: "model", text: reply, toolCalls: [] });
    if (reason === "out_of_catalog") state.outOfCatalogAsked = true;
    store.escalate(threadId, reason, message.slice(0, 200));
    emit({ type: "derivation", threadId, details: { reason } });
    return reply;
  };

  return {
    store,

    async handle(input: AssistantInput): Promise<AssistantOutput> {
      const state = store.get(input.threadId);

      if (input.messageId) {
        const cached = store.getCachedReply(input.threadId, input.messageId);
        if (cached !== undefined) {
          return { threadId: input.threadId, reply: cached, escalated: state.escalation !== undefined };
        }
      }

      state.turnCount += 1;
      store.rememberDeclaredAmounts(input.threadId, extractAmounts(input.text));
      const assessment = assessInput(input.text);

      if (assessment.reasons.length > 0) {
        const [reason] = assessment.reasons;
        if (reason) {
          const reply = derive(input.threadId, state, reason, input.text);
          if (input.messageId) store.cacheReply(input.threadId, input.messageId, reply);
          return { threadId: input.threadId, reply, escalated: true };
        }
      }

      state.turns.push({ role: "user", text: input.text });

      const generate = async (): Promise<string> => {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
          if (!canRequest()) return "";
          const response = await options.responder({
            systemPrompt,
            turns: [...state.turns],
            tools: TOOL_SPECS,
          });
          const modelTurn: ChatTurn = { role: "model", text: response.text, toolCalls: response.toolCalls };
          state.turns.push(modelTurn);

          if (response.toolCalls.length === 0) return response.text;

          for (const call of response.toolCalls) {
            const result = executeTool(call.name, call.args, { threadId: input.threadId, store });
            state.turns.push({
              role: "tool",
              name: call.name,
              ...(call.id ? { id: call.id } : {}),
              result,
            });
          }
        }
        return "";
      };

      const validate = (text: string): Violation[] =>
        validateOutput({
          text,
          allowedAmounts: allowedAmountsFor(state.declaredAmounts),
          systemPrompt,
          reservations: state.reservations,
          requestedOutOfCatalog: state.outOfCatalogAsked,
        });

      try {
        let text = await generate();
        let violations = text ? validate(text) : [{ validator: "tool_rounds", detail: "model exhausted tool rounds" }];

        for (let attempt = 0; attempt < MAX_REGENERATIONS && violations.length > 0; attempt += 1) {
          state.turns.push({ role: "user", text: feedbackFor(violations) });
          text = await generate();
          violations = text ? validate(text) : [{ validator: "tool_rounds", detail: "model exhausted tool rounds" }];
        }

        if (violations.length > 0) {
          const reply = genericSafeReply();
          state.turns.push({ role: "model", text: reply, toolCalls: [] });
          store.escalate(input.threadId, "guardrail_blocked", violations.map((item) => item.detail).join("; "));
          emit({
            type: "guardrail.activated",
            threadId: input.threadId,
            details: { violations: violations.map((item) => item.validator) },
          });
          if (input.messageId) store.cacheReply(input.threadId, input.messageId, reply);
          return { threadId: input.threadId, reply, escalated: true };
        }

        if (input.messageId) store.cacheReply(input.threadId, input.messageId, text);
        return { threadId: input.threadId, reply: text, escalated: state.escalation !== undefined };
      } catch (error) {
        emit({
          type: "responder.failed",
          threadId: input.threadId,
          details: { message: error instanceof Error ? error.message : "unknown_error" },
        });
        throw error;
      }
    },
  };
}
