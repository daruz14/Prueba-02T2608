import { extractAmounts } from "../domain/amounts.js";
import type { ThreadState } from "../orchestrator/state.js";

export type LeadProfile = {
  readonly threadId: string;
  readonly name: string | null;
  readonly search: {
    readonly typology: string | null;
    readonly bedrooms: number | null;
    readonly orientation: string | null;
  };
  readonly budget: { readonly amountUf: number; readonly kind: "total" | "down_payment" } | null;
  readonly timeline: string | null;
  readonly unitsOfInterest: readonly string[];
  readonly visitScheduled: { readonly date: string; readonly time: string; readonly unitId: string | null } | null;
  readonly escalation: { readonly reason: string; readonly summary: string; readonly at: string } | null;
  readonly turnCount: number;
  readonly summary: string;
  readonly generatedAt: string;
};

const BEDROOMS_PATTERN = /\b(\d)\s*dorm/i;
const TYPOLOGY_PATTERN = /\b(\d)d(\d)b\b/gi;
const ORIENTATION_PATTERN = /\b(norte|sur|poniente|oriente)\b/i;
const NAME_PATTERN = /\bme llamo ([A-ZÁÉÍÓÚ][\wáéíóú]+)/i;
const DOWN_PAYMENT_PATTERN = /\b(pie|pie de|primera cuota)\b/i;
const TIMELINE_PATTERN = /\bantes de ([^.!?,]{3,40})/i;
const BUDGET_CONTEXT_PATTERN = /\b(presupuesto|pie|cuesta|hasta|uf|precio|bolsa)\b/i;
const UNIT_PATTERN = /\b([A-Z]-\d{3,4})\b/g;

function userTexts(state: ThreadState): string[] {
  return state.turns.flatMap((turn) => (turn.role === "user" ? [turn.text] : []));
}

function findBudget(texts: readonly string[]): LeadProfile["budget"] {
  let best: { amountUf: number; kind: "total" | "down_payment" } | undefined;
  for (const text of texts) {
    if (!BUDGET_CONTEXT_PATTERN.test(text)) continue;
    const amounts = [...extractAmounts(text).uf];
    const amount = amounts.length > 0 ? Math.max(...amounts) : undefined;
    if (amount === undefined) continue;
    if (!best || amount > best.amountUf) {
      best = { amountUf: amount, kind: DOWN_PAYMENT_PATTERN.test(text) ? "down_payment" : "total" };
    }
  }
  return best ?? null;
}

function findFirst(pattern: RegExp, texts: readonly string[]): string | undefined {
  for (const text of texts) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function findUnits(texts: readonly string[]): string[] {
  const units = new Set<string>();
  for (const text of texts) {
    for (const [, id] of text.matchAll(UNIT_PATTERN)) {
      if (id) units.add(id);
    }
  }
  return [...units];
}

function buildSummary(parts: readonly string[]): string {
  const capitalized = parts.slice(0, 3).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`);
  return `${capitalized.join(". ")}.`;
}

export function buildLeadProfile(state: ThreadState): LeadProfile {
  const texts = userTexts(state);
  const name = findFirst(NAME_PATTERN, texts) ?? null;
  const bedroomsText = findFirst(BEDROOMS_PATTERN, texts);
  const bedrooms = bedroomsText ? Number(bedroomsText) : null;
  const typologyMatch = texts.flatMap((text) => [...text.matchAll(TYPOLOGY_PATTERN)]).at(0);
  const typology = typologyMatch ? `${typologyMatch[1]}D${typologyMatch[2]}B` : null;
  const orientation = findFirst(ORIENTATION_PATTERN, texts) ?? null;
  const budget = findBudget(texts);
  const timeline = findFirst(TIMELINE_PATTERN, texts) ?? null;
  const unitsOfInterest = findUnits(texts);
  const reservation = state.reservations[0];
  const visitScheduled = reservation
    ? { date: reservation.date, time: reservation.time, unitId: reservation.unitId ?? null }
    : null;

  const summaryParts: string[] = [];
  const searchText = typology ?? (bedrooms ? `${bedrooms} dormitorios` : null);
  if (name) {
    summaryParts.push(`Me llamo ${name}`);
    if (searchText) summaryParts.push(`busco ${searchText}`);
  } else {
    summaryParts.push(searchText ? `Busco ${searchText}` : "Busco departamento");
  }
  if (budget) {
    summaryParts.push(`presupuesto de ${budget.amountUf} UF (${budget.kind === "down_payment" ? "pie" : "total"})`);
  }
  if (unitsOfInterest.length > 0) summaryParts.push(`me interesa ${unitsOfInterest.join(", ")}`);
  if (visitScheduled) summaryParts.push(`visita agendada ${visitScheduled.date} ${visitScheduled.time}`);
  if (state.escalation) summaryParts.push(`derivado por ${state.escalation.reason}`);

  return {
    threadId: state.threadId,
    name,
    search: { typology, bedrooms, orientation },
    budget,
    timeline,
    unitsOfInterest,
    visitScheduled,
    escalation: state.escalation ?? null,
    turnCount: state.turnCount,
    summary: buildSummary(summaryParts),
    generatedAt: new Date().toISOString(),
  };
}
