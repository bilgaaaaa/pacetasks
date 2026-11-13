import { addDays, weekdayIndex } from "@domain/dates";
import { localized, msg } from "../i18n";

// Calendar math behind the add sheet's day picker: the next seven days as a
// strip, and a month as a Monday-first grid. Pure, on date keys ("YYYY-MM-DD")
// and month keys ("YYYY-MM"), so it ignores time zones and DST.

const WEEKDAY_SHORT = localized([msg("Sun"), msg("Mon"), msg("Tue"), msg("Wed"), msg("Thu"), msg("Fri"), msg("Sat")]);
const MONTH_NAMES = localized([
  msg("January"), msg("February"), msg("March"), msg("April"), msg("May|full month"), msg("June"),
  msg("July"), msg("August"), msg("September"), msg("October"), msg("November"), msg("December"),
]);

// Column headers of the month grid; the week starts on Monday, like "This week" does.
export const GRID_WEEKDAYS = localized([msg("Mon"), msg("Tue"), msg("Wed"), msg("Thu"), msg("Fri"), msg("Sat"), msg("Sun")]);

export const DAY_PICKER_POLICY = {
  stripDays: 7, // today and the six days after it
  monthsAhead: 12, // how far the month view can be paged forward
} as const;

export interface PickerDay {
  key: string; // "YYYY-MM-DD"
  weekday: string; // "Mon"
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean; // before today: shown in the month grid but not selectable
}

function toPickerDay(key: string, todayKey: string): PickerDay {
  return {
    key,
    weekday: WEEKDAY_SHORT[weekdayIndex(key)],
    dayOfMonth: Number(key.slice(8, 10)),
    isToday: key === todayKey,
    isPast: key < todayKey,
  };
}

// Today and the days after it, for the one-row strip.
export function buildDayStrip(todayKey: string, count: number = DAY_PICKER_POLICY.stripDays): PickerDay[] {
  return Array.from({ length: count }, (_, index) => toPickerDay(addDays(todayKey, index), todayKey));
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

// Moves a month key by whole months: ("2026-12", 1) → "2027-01".
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// "October 2026"
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// The month as rows of seven cells, Monday first; null pads the days that
// belong to the neighbouring months so every row lines up under its weekday.
export function buildMonthGrid(monthKey: string, todayKey: string): (PickerDay | null)[][] {
  const firstDay = `${monthKey}-01`;
  const daysInMonth = Number(addDays(`${shiftMonth(monthKey, 1)}-01`, -1).slice(8, 10));
  const leadingBlanks = (weekdayIndex(firstDay) + 6) % 7; // Monday = 0
  const cells: (PickerDay | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => toPickerDay(addDays(firstDay, index), todayKey)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

// The month view can show the current month up to DAY_PICKER_POLICY.monthsAhead later.
export function canShowMonth(monthKey: string, todayKey: string): boolean {
  const first = monthKeyOf(todayKey);
  return monthKey >= first && monthKey <= shiftMonth(first, DAY_PICKER_POLICY.monthsAhead);
}
