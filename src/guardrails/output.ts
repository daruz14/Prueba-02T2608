import { extractAmounts, type Amounts } from "../domain/amounts.js";
import { knownPricesUf, unitById } from "../domain/catalog.js";
import { isQuotableTime, type Reservation } from "../domain/scheduling.js";

export type { Reservation };

export type Violation = {
  readonly validator: string;
  readonly detail: string;
};

export type OutputContext = {
  readonly text: string;
  readonly allowedAmounts: Amounts;
  readonly systemPrompt: string;
  readonly reservations: readonly Reservation[];
  readonly requestedOutOfCatalog: boolean;
};

const DISCOUNT_PATTERN =
  /\b(descuento|descuentos|rebaja|rebajas|bonificaci[oó]n|promoci[oó]n|promociones|dto)\b|\b\d{1,2}\s?%/i;

const UNIT_ID_PATTERN = /\b([A-Z]{1,2}-\d{1,4})\b/g;

const NEGATION_PATTERN =
  /\b(no|nunca|nadie|vendid[oa]|agotad[oa]|ya fue|no está disponible|no queda|no contamos)\b|\bse vendi[oó]/i;

const AFFIRMATIVE_BOOKING_PATTERN =
  /\b(qued[oó] (agendad[ao]|reservad[ao]|confirmad[ao])|visita (confirmada|agendada|reservada)|confirm[eé] (tu|la) visita|te esperamos (el|a las)|reserva confirmada)\b/i;

const OUT_OF_CATALOG_PATTERN =
  /\b(arriend|alquiler|amoblad|casas?|local(?:es)?(?:\s+comercial)?|quint[oa]\s*dorm|4\s*dorm|cuatro\s*dorm)/i;

const AFFIRMATION_PATTERN = /\b(s[ií]|tenemos|contamos|disponemos|hay|existe|ofrecemos)\b/i;

const DAY_WORDS: readonly { readonly day: number; readonly pattern: RegExp }[] = [
  { day: 0, pattern: /\bdomingos?\b/i },
  { day: 1, pattern: /\blunes(?:es)?\b/i },
  { day: 2, pattern: /\bmartes\b/i },
  { day: 3, pattern: /\bmi[eé]rcoles\b/i },
  { day: 4, pattern: /\bjueves\b/i },
  { day: 5, pattern: /\bviernes\b/i },
  { day: 6, pattern: /\bs[aá]bados?\b/i },
];

function dayMentionedIn(sentence: string): number | undefined {
  return DAY_WORDS.find((entry) => entry.pattern.test(sentence))?.day;
}
const NGRAM_WORDS = 10;

const PROMPT_LEAK_MARKERS =
  /\b(mis instrucciones|instrucciones del sistema|eres un asistente|system prompt|instrucci[oó]nes del asistente|confidencial|modo (dev|desarrollador))\b/i;

function sentencesOf(text: string): string[] {
  return text.split(/[.!?\n]+/).filter((sentence) => sentence.trim().length > 0);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkAmounts(text: string, allowed: Amounts): Violation[] {
  const found = extractAmounts(text);
  const violations: Violation[] = [];
  const known = { uf: new Set([...knownPricesUf(), ...allowed.uf]), pesos: allowed.pesos };

  for (const value of found.uf) {
    if (!known.uf.has(value)) {
      violations.push({ validator: "amounts", detail: `UF ${value} is not in the catalog` });
    }
  }
  for (const value of found.pesos) {
    if (!known.pesos.has(value)) {
      violations.push({ validator: "amounts", detail: `$${value} was never declared by the lead` });
    }
  }
  return violations;
}

export function checkUnits(text: string): Violation[] {
  const violations: Violation[] = [];
  for (const sentence of sentencesOf(text)) {
    for (const [, id] of sentence.matchAll(UNIT_ID_PATTERN)) {
      if (!id) continue;
      const unit = unitById(id);
      if (!unit) {
        violations.push({ validator: "units", detail: `unit ${id} does not exist` });
        continue;
      }
      if (!unit.available && !NEGATION_PATTERN.test(sentence)) {
        violations.push({ validator: "units", detail: `sold unit ${id} offered without denial` });
      }
    }
  }
  return violations;
}

export function checkDiscounts(text: string): Violation[] {
  if (!DISCOUNT_PATTERN.test(text)) return [];
  return [{ validator: "discounts", detail: "discount policy must never be mentioned" }];
}

export function checkSchedule(text: string, reservations: readonly Reservation[]): Violation[] {
  const violations: Violation[] = [];
  for (const sentence of sentencesOf(text)) {
    const day = dayMentionedIn(sentence);
    const checkedTimes = new Set<string>();
    for (const [time] of sentence.matchAll(/\b(\d{1,2}:\d{2})\b/g)) {
      if (!time || checkedTimes.has(time)) continue;
      checkedTimes.add(time);
      if (!isQuotableTime(time, day)) {
        violations.push({ validator: "schedule", detail: `${time} is outside office hours` });
      }
    }
    const claimsBooking = AFFIRMATIVE_BOOKING_PATTERN.test(sentence) && !/\bno\b/i.test(sentence);
    if (claimsBooking && reservations.length === 0) {
      violations.push({ validator: "schedule", detail: "claims a booking that was never made" });
    }
  }
  return violations;
}

export function checkCatalogScope(text: string, requestedOutOfCatalog: boolean): Violation[] {
  if (!requestedOutOfCatalog) return [];
  const violations: Violation[] = [];
  for (const sentence of sentencesOf(text)) {
    if (
      OUT_OF_CATALOG_PATTERN.test(sentence) &&
      AFFIRMATION_PATTERN.test(sentence) &&
      !NEGATION_PATTERN.test(sentence)
    ) {
      violations.push({ validator: "catalog_scope", detail: `affirms something outside the catalog: ${sentence.trim()}` });
    }
  }
  return violations;
}

export function checkPromptLeak(text: string, systemPrompt: string): Violation[] {
  if (PROMPT_LEAK_MARKERS.test(text)) {
    return [{ validator: "prompt_leak", detail: "response contains prompt disclosure markers" }];
  }

  const violations: Violation[] = [];
  const promptWords = normalize(systemPrompt).split(" ");
  if (promptWords.length < NGRAM_WORDS) return violations;
  const normalizedText = ` ${normalize(text)} `;
  for (let index = 0; index + NGRAM_WORDS <= promptWords.length; index += 1) {
    const ngram = promptWords.slice(index, index + NGRAM_WORDS).join(" ");
    if (normalizedText.includes(` ${ngram} `)) {
      violations.push({ validator: "prompt_leak", detail: `response repeats a ${NGRAM_WORDS}-word sequence from the system prompt` });
      break;
    }
  }
  return violations;
}

export function validateOutput(context: OutputContext): Violation[] {
  return [
    ...checkAmounts(context.text, context.allowedAmounts),
    ...checkUnits(context.text),
    ...checkDiscounts(context.text),
    ...checkSchedule(context.text, context.reservations),
    ...checkCatalogScope(context.text, context.requestedOutOfCatalog),
    ...checkPromptLeak(context.text, context.systemPrompt),
  ];
}
