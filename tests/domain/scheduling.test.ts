import { describe, expect, it } from "vitest";
import {
  isValidDate,
  isTimeInsideSchedule,
  isValidVisitSlot,
  nextValidSlots,
  parseSchedules,
  weekdayOf,
} from "../../src/domain/scheduling.js";

describe("parseSchedules", () => {
  it("expands weekday and saturday ranges from the catalog", () => {
    const ranges = parseSchedules(["Lun-Vie 10:00-18:00", "Sáb 10:00-14:00"]);
    expect(ranges).toHaveLength(6);
    expect(ranges.filter((range) => range.day === 1)).toHaveLength(1);
    expect(ranges.find((range) => range.day === 6)).toMatchObject({ from: "10:00", to: "14:00" });
  });

  it("ignores malformed entries instead of crashing", () => {
    expect(parseSchedules(["tomorrow morning"])).toHaveLength(0);
  });
});

describe("isValidDate", () => {
  it("accepts ISO dates and rejects anything else", () => {
    expect(isValidDate("2026-10-12")).toBe(true);
    expect(isValidDate("12-10-2026")).toBe(false);
    expect(isValidDate("2026-13-45")).toBe(false);
  });
});

describe("weekdayOf", () => {
  it("resolves weekdays in America/Santiago", () => {
    expect(weekdayOf("2026-10-12")).toBe(1);
    expect(weekdayOf("2026-10-10")).toBe(6);
    expect(weekdayOf("2026-10-11")).toBe(0);
  });
});

describe("isValidVisitSlot", () => {
  it("accepts slots inside office hours", () => {
    expect(isValidVisitSlot("2026-10-12", "11:00")).toBe(true);
    expect(isValidVisitSlot("2026-10-10", "13:59")).toBe(true);
  });

  it("rejects slots outside office hours", () => {
    expect(isValidVisitSlot("2026-10-12", "19:00")).toBe(false);
    expect(isValidVisitSlot("2026-10-12", "09:00")).toBe(false);
    expect(isValidVisitSlot("2026-10-12", "18:00")).toBe(false);
    expect(isValidVisitSlot("2026-10-10", "14:00")).toBe(false);
    expect(isValidVisitSlot("2026-10-11", "11:00")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidVisitSlot("yesterday", "11:00")).toBe(false);
    expect(isValidVisitSlot("2026-10-12", "25:99")).toBe(false);
    expect(isValidVisitSlot("2026-10-12", "11")).toBe(false);
  });
});

describe("isTimeInsideSchedule", () => {
  it("accepts times covered by any schedule and rejects the rest", () => {
    expect(isTimeInsideSchedule("11:00")).toBe(true);
    expect(isTimeInsideSchedule("13:00")).toBe(true);
    expect(isTimeInsideSchedule("19:00")).toBe(false);
    expect(isTimeInsideSchedule("08:30")).toBe(false);
  });
});

describe("nextValidSlots", () => {
  it("returns only slots inside office hours and skips closed days", () => {
    const slots = nextValidSlots("2026-10-10", 3);
    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.date)).not.toContain("2026-10-11");
    for (const slot of slots) {
      expect(isValidVisitSlot(slot.date, slot.time)).toBe(true);
    }
  });
});
