import { addDays, isValidDateKey } from "../dates.ts";
import type { DueKind } from "../task.ts";
import type { DateExpression } from "./aiResult.ts";

export type DateResolution =
  | { ok: true; dueDate: string; dueKind: DueKind; inPast: boolean }
  | { ok: false; reason: "vague" | "invalid_date" };

// ISO weekday of a date key: 1 = Monday … 7 = Sunday.
function isoWeekday(dateKey: string): number {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

const SATURDAY = 6;
const DAYS_PER_WEEK = 7;
// Far enough ahead to reach the next 29 February, even across a skipped leap year.
const MONTHS_SEARCHED = 8 * 12 + 1;

function monthKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The first real calendar day with this day-of-month on or after today, in
// `month` when one was named. Null when no such day exists ("30 February").
function upcomingMonthDay(todayKey: string, month: number | null, day: number): string | null {
  const [year, thisMonth] = todayKey.split("-").map(Number);
  for (let monthsAhead = 0; monthsAhead < MONTHS_SEARCHED; monthsAhead++) {
    const monthIndex = thisMonth - 1 + monthsAhead;
    const candidateMonth = (monthIndex % 12) + 1;
    if (month !== null && candidateMonth !== month) continue;
    const dateKey = monthKey(year + Math.floor(monthIndex / 12), candidateMonth, day);
    if (isValidDateKey(dateKey) && dateKey >= todayKey) return dateKey;
  }
  return null;
}

function lastDayOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  const firstOfNextMonth = month === 12 ? monthKey(year + 1, 1, 1) : monthKey(year, month + 1, 1);
  return addDays(firstOfNextMonth, -1);
}

// Turns the model's date description into a calendar day relative to the
// phone's today. Deterministic: the model never computes dates itself.
// Weekdays: "on"/"by" mean the upcoming one, today included; "next" means the
// upcoming one strictly after today; "next_week" the one in next week (Monday first).
export function resolveDate(expression: DateExpression, todayKey: string): DateResolution {
  switch (expression.kind) {
    case "relative_day":
      return {
        ok: true,
        dueDate: addDays(todayKey, expression.offsetDays),
        dueKind: expression.relation,
        inPast: false,
      };

    case "weekday": {
      const today = isoWeekday(todayKey);
      const daysAhead = (expression.weekday - today + DAYS_PER_WEEK) % DAYS_PER_WEEK;
      const offset =
        expression.relation === "next_week"
          ? DAYS_PER_WEEK - today + expression.weekday
          : expression.relation === "next" && daysAhead === 0
            ? DAYS_PER_WEEK
            : daysAhead;
      return {
        ok: true,
        dueDate: addDays(todayKey, offset),
        dueKind: expression.relation === "by" ? "by" : "on",
        inPast: false,
      };
    }

    case "weekend":
      // On a Saturday or Sunday the weekend is already here, so it means today.
      return {
        ok: true,
        dueDate: addDays(todayKey, Math.max(0, SATURDAY - isoWeekday(todayKey))),
        dueKind: expression.relation,
        inPast: false,
      };

    case "month_day": {
      const dueDate = upcomingMonthDay(todayKey, expression.month, expression.day);
      if (!dueDate) return { ok: false, reason: "invalid_date" };
      return { ok: true, dueDate, dueKind: expression.relation, inPast: false };
    }

    case "month_end":
      return { ok: true, dueDate: lastDayOfMonth(todayKey), dueKind: expression.relation, inPast: false };

    case "absolute":
      if (!isValidDateKey(expression.date)) return { ok: false, reason: "invalid_date" };
      return {
        ok: true,
        dueDate: expression.date,
        dueKind: expression.relation,
        inPast: expression.date < todayKey,
      };

    case "vague":
      return { ok: false, reason: "vague" };
  }
}
