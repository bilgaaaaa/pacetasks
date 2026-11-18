// A day's calendar events and reminders for the Today screen, read by the DeskFocus bridge from the calendars
// switched on in the widget's settings. Field names match CalendarItemPayload in
// targets/deskfocus/_shared/CalendarItemsBridge.swift.
import { formatTimeOfDay } from "./timeFormat";
import { t } from "../i18n";

export interface CalendarItem {
  id: string;
  kind: "event" | "reminder";
  reminderId: string | null; // what checking a reminder off sends back; null for events
  title: string;
  calendarTitle: string;
  colorHex: string;
  isAllDay: boolean;
  startsAt: number | null; // ms since epoch: an event's start, a timed reminder's due time
  endsAt: number | null;
}

const optionalNumber = (value: unknown): value is number | null | undefined =>
  value === null || value === undefined || typeof value === "number";

function parseItem(value: unknown): CalendarItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    (item.kind !== "event" && item.kind !== "reminder") ||
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.calendarTitle !== "string" ||
    typeof item.colorHex !== "string" ||
    typeof item.isAllDay !== "boolean" ||
    !optionalNumber(item.startsAt) ||
    !optionalNumber(item.endsAt)
  ) {
    return null;
  }
  return {
    id: item.id,
    kind: item.kind,
    reminderId: typeof item.reminderId === "string" ? item.reminderId : null,
    title: item.title,
    calendarTitle: item.calendarTitle,
    colorHex: item.colorHex,
    isAllDay: item.isAllDay,
    startsAt: item.startsAt ?? null,
    endsAt: item.endsAt ?? null,
  };
}

// Reads the handler's `calendarItems`; null when it is missing, unreadable items are dropped.
export function parseCalendarItems(value: unknown): CalendarItem[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(parseItem).filter((item): item is CalendarItem => item !== null);
}

function clockTime(ms: number): string {
  const date = new Date(ms);
  return formatTimeOfDay(date.getHours(), date.getMinutes());
}

// When it happens, on the phone's clock: "All day", "09:00–10:30", "09:00" for a timed reminder,
// "" for a reminder with no time.
export function calendarItemTime(item: CalendarItem): string {
  if (item.isAllDay) return item.kind === "event" ? t("All day") : "";
  if (item.startsAt === null) return "";
  return item.endsAt === null ? clockTime(item.startsAt) : `${clockTime(item.startsAt)}–${clockTime(item.endsAt)}`;
}
