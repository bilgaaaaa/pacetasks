// Calendar helpers. "Today" always comes from the phone: either the device's
// local clock (app) or the IANA time zone the phone sent (Edge Functions).

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Returns the "YYYY-MM-DD" calendar day of `date`, in `timeZone` when given,
// otherwise in the device's local time zone.
export function toLocalDateKey(date: Date, timeZone?: string): string {
  if (!timeZone) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// True for a real calendar day such as "2026-02-28" (rejects "2026-02-30").
export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// True for a 24h "HH:MM" time, the format of tasks.scheduled_time.
export function isValidTimeOfDay(value: string): boolean {
  return TIME_OF_DAY_PATTERN.test(value);
}

// Shifts a date key by whole days; pure calendar math, unaffected by DST.
export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (positive when `to` is later).
export function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / msPerDay
  );
}
