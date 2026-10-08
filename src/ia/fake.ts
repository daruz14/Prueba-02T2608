import type { ChatRequest, ChatResponse, Responder, ToolCall } from "./types.js";

const EMPTY_INPUT_REPLY = "Hola 👋 ¿Qué departamento estás buscando?";

const ISO_DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/;
const TIME_PATTERN = /\b(\d{1,2}:\d{2})\b/;
const UNIT_PATTERN = /\b([A-Z]-\d{3,4})\b/;

function lastTurn(request: ChatRequest) {
  return request.turns[request.turns.length - 1];
}

const SCHEDULE_ERRORS: Readonly<Record<string, string>> = {
  outside_office_hours: "en ese horario no atendemos",
  slot_already_booked: "ese horario ya está reservado",
  unit_not_available: "esa unidad ya no está disponible",
  unknown_unit: "no encuentro esa unidad",
  invalid_date: "esa fecha no es válida",
  missing_date_or_time: "me falta la fecha o la hora",
};

function toolTurnSummary(name: string, result: Record<string, unknown>): string {
  if (name === "schedule_visit") {
    if (result.ok === true) {
      return `Listo, quedó agendada tu visita el ${String(result.date)} a las ${String(result.time)}. Te esperamos en la sala de ventas 👍`;
    }
    const code = String(result.error ?? "");
    return `No pude agendar la visita: ${SCHEDULE_ERRORS[code] ?? "no disponible"}. ¿Te propongo otro horario?`;
  }
  if (name === "get_visit_hours") {
    const slots = Array.isArray(result.nextSlots) ? (result.nextSlots as { date: string; time: string }[]) : [];
    const first = slots[0];
    const hours = Array.isArray(result.hours) ? (result.hours as string[]).join(" y ") : "";
    return `Nuestros horarios de visita son ${hours}.${first ? ` Tenemos disponibilidad el ${first.date} a las ${first.time}.` : ""}`;
  }
  if (name === "search_units") {
    const units = Array.isArray(result.units) ? (result.units as { id: string; priceUf: number }[]) : [];
    if (units.length === 0) return "No tengo departamentos disponibles con ese filtro.";
    return `Tenemos ${units.length} departamentos disponibles: ${units.map((unit) => `${unit.id} (${unit.priceUf} UF)`).join(", ")}.`;
  }
  if (name === "get_unit_detail") {
    if (result.available === false) return "Esa unidad ya no está disponible 😔";
    const unit = result.unit as { id: string; typology: string; bedrooms: number; priceUf: number } | undefined;
    if (!unit) return "No encuentro esa unidad.";
    return `El ${unit.id} es de ${unit.typology} con ${unit.bedrooms} dormitorios y cuesta ${unit.priceUf} UF.`;
  }
  if (name === "escalate_to_agent") return "Te derivo con un ejecutivo del equipo, te contactará a la brevedad.";
  return "Procesé tu solicitud.";
}

function detectToolCall(text: string): ToolCall | undefined {
  const date = ISO_DATE_PATTERN.exec(text)?.[1];
  const time = TIME_PATTERN.exec(text)?.[1];
  const unitId = UNIT_PATTERN.exec(text)?.[1];
  if (date && time) {
    return { name: "schedule_visit", args: { date, time, ...(unitId ? { unitId } : {}) } };
  }
  if (/\b(visita|agendar|agenda|horario|abren|atencio)\w*/i.test(text)) {
    return { name: "get_visit_hours", args: {} };
  }
  if (/\b(departamento|precio|cuesta|cuanto|disponib)\w*/i.test(text)) {
    return { name: "search_units", args: {} };
  }
  return undefined;
}

export const fakeResponder: Responder = async (request: ChatRequest): Promise<ChatResponse> => {
  const last = lastTurn(request);

  if (last?.role === "tool") {
    return { text: toolTurnSummary(last.name, last.result), toolCalls: [] };
  }

  if (last?.role !== "user") {
    return { text: EMPTY_INPUT_REPLY, toolCalls: [] };
  }

  const text = last.text.trim();
  if (text.length === 0) {
    return { text: EMPTY_INPUT_REPLY, toolCalls: [] };
  }

  const toolCall = detectToolCall(text);
  if (toolCall) {
    return { text: "", toolCalls: [toolCall] };
  }

  return {
    text: `Recibí "${text}". (Respuesta simulada: el asistente real se conecta en la siguiente fase.)`,
    toolCalls: [],
  };
};
