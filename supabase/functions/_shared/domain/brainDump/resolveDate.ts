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

// Turns the model's date description into a calendar day relative to the
// phone's today. Deterministic: the model never computes dates itself.
// Weekdays: "on"/"by" mean the upcoming one, today included; "next" means the
// upcoming one strictly after today.
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
      const daysAhead = (expression.weekday - isoWeekday(todayKey) + 7) % 7;
      const offset = expression.relation === "next" && daysAhead === 0 ? 7 : daysAhead;
      return {
        ok: true,
        dueDate: addDays(todayKey, offset),
        dueKind: expression.relation === "by" ? "by" : "on",
        inPast: false,
      };
    }

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
