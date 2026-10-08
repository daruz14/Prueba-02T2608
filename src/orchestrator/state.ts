import type { Amounts } from "../domain/amounts.js";
import { mergeAmounts } from "../domain/amounts.js";
import type { Reservation } from "../domain/scheduling.js";
import type { ChatTurn } from "../ia/types.js";

export type Escalation = {
  readonly reason: string;
  readonly summary: string;
  readonly at: string;
};

export type ThreadState = {
  readonly threadId: string;
  readonly turns: ChatTurn[];
  readonly reservations: Reservation[];
  declaredAmounts: Amounts;
  escalation: Escalation | undefined;
  outOfCatalogAsked: boolean;
  turnCount: number;
};

export type ThreadStore = {
  get(threadId: string): ThreadState;
  peek(threadId: string): ThreadState | undefined;
  rememberDeclaredAmounts(threadId: string, amounts: Amounts): void;
  escalate(threadId: string, reason: string, summary: string): void;
  cacheReply(threadId: string, messageId: string, reply: string): void;
  getCachedReply(threadId: string, messageId: string): string | undefined;
};

const MAX_TURNS_PER_THREAD = 24;
const MAX_CACHED_REPLIES = 200;

function createThreadState(threadId: string): ThreadState {
  return {
    threadId,
    turns: [],
    reservations: [],
    declaredAmounts: { uf: new Set<number>(), pesos: new Set<number>() },
    escalation: undefined,
    outOfCatalogAsked: false,
    turnCount: 0,
  };
}

export function createThreadStore(): ThreadStore {
  const threads = new Map<string, ThreadState>();
  const replies = new Map<string, string>();

  const ensure = (threadId: string): ThreadState => {
    const existing = threads.get(threadId);
    if (existing) return existing;
    const created = createThreadState(threadId);
    threads.set(threadId, created);
    return created;
  };

  return {
    get: ensure,
    peek(threadId) {
      return threads.get(threadId);
    },
    rememberDeclaredAmounts(threadId, amounts) {
      const state = ensure(threadId);
      state.declaredAmounts = mergeAmounts(state.declaredAmounts, amounts);
    },
    escalate(threadId, reason, summary) {
      const state = ensure(threadId);
      state.escalation = { reason, summary, at: new Date().toISOString() };
    },
    cacheReply(threadId, messageId, reply) {
      const key = `${threadId}::${messageId}`;
      replies.set(key, reply);
      if (replies.size > MAX_CACHED_REPLIES) {
        const oldest = replies.keys().next().value;
        if (oldest) replies.delete(oldest);
      }
    },
    getCachedReply(threadId, messageId) {
      return replies.get(`${threadId}::${messageId}`);
    },
  };
}

export function appendTurn(state: ThreadState, turn: ChatTurn): void {
  state.turns.push(turn);
  while (state.turns.length > MAX_TURNS_PER_THREAD) {
    const removed = state.turns.shift();
    if (!removed) break;
    if (state.turns.length > 0 && state.turns[0]?.role === "tool") {
      state.turns.shift();
    }
  }
}
