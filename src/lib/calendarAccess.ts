// Calendar and Reminders access for the DeskFocus widget and Today's calendars, read and asked through the
// DeskFocus bridge's EventKit code (see src/lib/deskfocusBridge.ts). Only iOS has it: everywhere else access
// reads as "unavailable" and nothing is asked.
export type CalendarAccess = "granted" | "denied" | "undetermined" | "unavailable";

// Both permissions together: the widget and Today show events and reminders side by side.
export function combineAccess(calendar: CalendarAccess, reminders: CalendarAccess): CalendarAccess {
  if (calendar === "granted" && reminders === "granted") return "granted";
  if (calendar === "denied" || reminders === "denied") return "denied";
  if (calendar === "unavailable" || reminders === "unavailable") return "unavailable";
  return "undetermined";
}

const STATES: readonly CalendarAccess[] = ["granted", "denied", "undetermined"];

function toAccess(value: unknown): CalendarAccess {
  return STATES.includes(value as CalendarAccess) ? (value as CalendarAccess) : "unavailable";
}

// Reads the handler's `calendarAccess` ({ events, reminders }); anything unreadable is "unavailable".
export function parseCalendarAccess(value: unknown): CalendarAccess {
  if (!value || typeof value !== "object") return "unavailable";
  const { events, reminders } = value as { events?: unknown; reminders?: unknown };
  return combineAccess(toAccess(events), toAccess(reminders));
}
