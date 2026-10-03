import { addDays } from "@domain/dates";
import { DueKind } from "./types";

// The "Which day" choices in the add-task sheet, turned into the task's
// due_date/due_kind relative to the phone's today.

export const DUE_OPTION_IDS = ["any", "today", "tomorrow", "this_week"] as const;
export type DueOption = (typeof DUE_OPTION_IDS)[number];

export const DUE_OPTION_LABELS: Record<DueOption, string> = {
  any: "Any day",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
};

export interface ResolvedDue {
  due_date: string | null;
  due_kind: DueKind | null;
}

// "This week" is a deadline ("by") on the coming Sunday, or today when today is Sunday.
export function resolveDueOption(option: DueOption, todayKey: string): ResolvedDue {
  switch (option) {
    case "any":
      return { due_date: null, due_kind: null };
    case "today":
      return { due_date: todayKey, due_kind: "on" };
    case "tomorrow":
      return { due_date: addDays(todayKey, 1), due_kind: "on" };
    case "this_week": {
      const weekday = new Date(`${todayKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday
      return { due_date: addDays(todayKey, (7 - weekday) % 7), due_kind: "by" };
    }
  }
}
