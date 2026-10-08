import { availableUnits, loadCatalog, unitById, type Unit } from "../domain/catalog.js";
import {
  isValidDate,
  isValidVisitSlot,
  nextValidSlots,
  parseSchedules,
  todayInSantiago,
} from "../domain/scheduling.js";
import type { ToolSpec } from "../ia/types.js";
import type { ThreadStore } from "./state.js";

export const TOOL_SPECS: readonly ToolSpec[] = [
  {
    name: "search_units",
    description:
      "List apartments that are currently for sale, filtered by bedrooms, typology, maximum price in UF or orientation. Never returns sold units.",
    parameters: {
      type: "object",
      properties: {
        bedrooms: { type: "integer", description: "Number of bedrooms" },
        typology: { type: "string", description: "Typology such as 1D1B, 2D2B" },
        maxPriceUf: { type: "number", description: "Maximum price in UF" },
        orientation: { type: "string", description: "Orientation such as norte, poniente" },
      },
    },
  },
  {
    name: "get_unit_detail",
    description: "Return the details of one apartment by id. Sold units only report available: false.",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Unit id such as A-301" } },
      required: ["id"],
    },
  },
  {
    name: "get_visit_hours",
    description: "Return the sales office visit hours and the next available slots.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "schedule_visit",
    description:
      "Schedule a visit to the sales office. The date and time are validated against the office hours before being stored.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date such as 2026-10-12" },
        time: { type: "string", description: "24h time such as 11:00" },
        unitId: { type: "string", description: "Optional apartment id the lead wants to see" },
      },
      required: ["date", "time"],
    },
  },
  {
    name: "escalate_to_agent",
    description: "Hand the conversation over to a human agent with a reason and a short summary.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Escalation reason code" },
        summary: { type: "string", description: "Short summary in Spanish for the agent" },
      },
      required: ["reason", "summary"],
    },
  },
];

export type ToolContext = {
  readonly threadId: string;
  readonly store: ThreadStore;
};

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const [, rawHours, minutes] = match;
  if (!rawHours || !minutes) return time;
  return `${rawHours.padStart(2, "0")}:${minutes}`;
}

function unitSummary(unit: Unit) {
  return {
    id: unit.id,
    typology: unit.typology,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    squareMeters: unit.squareMeters,
    priceUf: unit.priceUf,
    floor: unit.floor,
    orientation: unit.orientation,
    available: unit.available,
  };
}

function searchUnits(args: Record<string, unknown>): Record<string, unknown> {
  const bedrooms = numberArg(args, "bedrooms");
  const typology = stringArg(args, "typology");
  const maxPriceUf = numberArg(args, "maxPriceUf");
  const orientation = stringArg(args, "orientation");

  const units = availableUnits().filter((unit) => {
    if (bedrooms !== undefined && unit.bedrooms !== bedrooms) return false;
    if (typology && unit.typology.toLowerCase() !== typology.toLowerCase()) return false;
    if (maxPriceUf !== undefined && unit.priceUf > maxPriceUf) return false;
    if (orientation && !unit.orientation.toLowerCase().includes(orientation.toLowerCase())) return false;
    return true;
  });

  return { units: units.map(unitSummary) };
}

function unitDetail(args: Record<string, unknown>): Record<string, unknown> {
  const id = stringArg(args, "id");
  if (!id) return { error: "missing_id" };
  const unit = unitById(id);
  if (!unit) return { error: "unknown_unit", id };
  if (!unit.available) return { id: unit.id, available: false };
  return { available: true, unit: unitSummary(unit) };
}

function visitHours(): Record<string, unknown> {
  const today = todayInSantiago();
  return {
    hours: loadCatalog().project.visitHours,
    ranges: parseSchedules(),
    nextSlots: nextValidSlots(today, 5),
    today,
  };
}

function scheduleVisit(args: Record<string, unknown>, context: ToolContext): Record<string, unknown> {
  const rawDate = stringArg(args, "date");
  const rawTime = stringArg(args, "time");
  const unitId = stringArg(args, "unitId");

  if (!rawDate || !rawTime) return { ok: false, error: "missing_date_or_time" };
  if (!isValidDate(rawDate)) return { ok: false, error: "invalid_date", date: rawDate };

  const time = normalizeTime(rawTime);
  if (!isValidVisitSlot(rawDate, time)) {
    return { ok: false, error: "outside_office_hours", date: rawDate, time };
  }

  const state = context.store.get(context.threadId);
  const conflict = state.reservations.some(
    (reservation) => reservation.date === rawDate && reservation.time === time,
  );
  if (conflict) return { ok: false, error: "slot_already_booked", date: rawDate, time };

  if (unitId) {
    const unit = unitById(unitId);
    if (!unit) return { ok: false, error: "unknown_unit", unitId };
    if (!unit.available) return { ok: false, error: "unit_not_available", unitId };
  }

  state.reservations.push({ date: rawDate, time, ...(unitId ? { unitId } : {}) });
  return { ok: true, date: rawDate, time, unitId: unitId ?? null };
}

function escalate(args: Record<string, unknown>, context: ToolContext): Record<string, unknown> {
  const reason = stringArg(args, "reason") ?? "unspecified";
  const summary = stringArg(args, "summary") ?? "";
  context.store.escalate(context.threadId, reason, summary);
  return { ok: true, reason };
}

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Record<string, unknown> {
  switch (name) {
    case "search_units":
      return searchUnits(args);
    case "get_unit_detail":
      return unitDetail(args);
    case "get_visit_hours":
      return visitHours();
    case "schedule_visit":
      return scheduleVisit(args, context);
    case "escalate_to_agent":
      return escalate(args, context);
    default:
      return { error: "unknown_tool", name };
  }
}
