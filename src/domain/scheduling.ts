import { loadCatalog } from "./catalog.js";

export type HourRange = {
  readonly day: number;
  readonly from: string;
  readonly to: string;
};

export type Reservation = {
  readonly date: string;
  readonly time: string;
  readonly unitId?: string;
};

const WEEKDAYS_IN_CATALOG: Record<string, number> = {
  Dom: 0,
  Lun: 1,
  Mar: 2,
  Mié: 3,
  Jue: 4,
  Vie: 5,
  Sáb: 6,
};

const WEEKDAYS_IN_ENGLISH: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const TIMEZONE = "America/Santiago";

const SCHEDULE_PATTERN =
  /^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)(?:-([A-Za-zÁÉÍÓÚáéíóúñÑ]+))?\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function expandDays(fromDay: number, toDay: number | undefined): number[] {
  const lastDay = toDay ?? fromDay;
  const days: number[] = [];
  if (fromDay <= lastDay) {
    for (let day = fromDay; day <= lastDay; day += 1) days.push(day);
    return days;
  }
  for (let day = fromDay; day <= 6; day += 1) days.push(day);
  for (let day = 0; day <= lastDay; day += 1) days.push(day);
  return days;
}

export function parseSchedules(texts: readonly string[] = loadCatalog().project.visitHours): HourRange[] {
  return texts.flatMap((text) => {
    const match = SCHEDULE_PATTERN.exec(text.trim());
    if (!match) return [];
    const [, startDay, endDay, from, to] = match;
    if (!from || !to) return [];
    const start = WEEKDAYS_IN_CATALOG[startDay as keyof typeof WEEKDAYS_IN_CATALOG];
    const end = endDay ? WEEKDAYS_IN_CATALOG[endDay as keyof typeof WEEKDAYS_IN_CATALOG] : start;
    if (start === undefined || end === undefined) return [];
    return expandDays(start, end).map((day) => ({ day, from, to }));
  });
}

export function weekdayOf(isoDate: string): number {
  const noonUtc = new Date(`${isoDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).formatToParts(noonUtc);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  return WEEKDAYS_IN_ENGLISH[weekday as keyof typeof WEEKDAYS_IN_ENGLISH] ?? 0;
}

export function isValidDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  return !Number.isNaN(new Date(`${isoDate}T12:00:00Z`).getTime());
}

export function isValidVisitSlot(isoDate: string, time: string): boolean {
  if (!isValidDate(isoDate) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const day = weekdayOf(isoDate);
  const minutes = toMinutes(time);
  return parseSchedules().some(
    (range) => range.day === day && minutes >= toMinutes(range.from) && minutes < toMinutes(range.to),
  );
}

export function isTimeInsideSchedule(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const minutes = toMinutes(time);
  return parseSchedules().some(
    (range) => minutes >= toMinutes(range.from) && minutes < toMinutes(range.to),
  );
}

export function isQuotableTime(time: string, day?: number): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const minutes = toMinutes(time);
  const ranges = parseSchedules().filter((range) => day === undefined || range.day === day);
  return ranges.some((range) => minutes >= toMinutes(range.from) && minutes <= toMinutes(range.to));
}

export function nextValidSlots(
  fromDate: string,
  count: number,
  preferredTime = "11:00",
): { date: string; time: string }[] {
  const slots: { date: string; time: string }[] = [];
  const start = new Date(`${fromDate}T12:00:00Z`);
  for (let offset = 0; offset < 21 && slots.length < count; offset += 1) {
    const date = new Date(start.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    if (isValidVisitSlot(date, preferredTime)) {
      slots.push({ date, time: preferredTime });
    }
  }
  return slots;
}

export function todayInSantiago(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
}
