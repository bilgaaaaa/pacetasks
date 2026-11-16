import { addDays, weekdayIndex } from "./dates.ts";

// Repeating tasks: each occurrence is its own task, and completing one adds the
// next (public.complete_task in supabase/migrations/20261116000000_task_repeats.sql).
// The database is the source of truth; nextRepeatDate mirrors next_repeat_date for
// the web demo and the tests, so keep both in step.

export const REPEAT_RULES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type RepeatRule = (typeof REPEAT_RULES)[number];

const SATURDAY = 6;
const SUNDAY = 0;

function isWeekend(dateKey: string): boolean {
  const weekday = weekdayIndex(dateKey);
  return weekday === SATURDAY || weekday === SUNDAY;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1–12; day 0 is the last of that month
}

// The anchor's day of the month moved `months` later, or that month's last day when it is shorter.
function addMonthsClamped(anchor: string, months: number): string {
  const [year, month, day] = anchor.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

// The first day after `afterDay` the rule falls on. Weekly keeps the anchor's
// weekday, monthly its day of the month. Days are "YYYY-MM-DD".
export function nextRepeatDate(rule: RepeatRule, anchor: string, afterDay: string): string {
  const day = addDays(afterDay, 1);
  switch (rule) {
    case "daily":
      return day;
    case "weekdays": {
      let next = day;
      while (isWeekend(next)) next = addDays(next, 1);
      return next;
    }
    case "weekly":
      return addDays(day, (weekdayIndex(anchor) - weekdayIndex(day) + 7) % 7);
    case "monthly": {
      const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
      const [dayYear, dayMonth] = day.split("-").map(Number);
      let months = Math.max(0, (dayYear - anchorYear) * 12 + dayMonth - anchorMonth - 1);
      let candidate = addMonthsClamped(anchor, months);
      while (candidate < day) candidate = addMonthsClamped(anchor, ++months);
      return candidate;
    }
  }
}

// The day the next occurrence goes on once this one is completed on `localDay`:
// after the later of its own day and today, so missed days never pile up.
export function nextOccurrenceDay(
  task: { repeat_rule: RepeatRule; repeat_anchor: string; due_date: string | null },
  localDay: string
): string {
  const after = task.due_date !== null && task.due_date > localDay ? task.due_date : localDay;
  return nextRepeatDate(task.repeat_rule, task.repeat_anchor, after);
}
