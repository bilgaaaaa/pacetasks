// Calendar and Reminders access for the DeskFocus widget, which reads them itself with the app's permission.
// Only iOS has the widget, so everywhere else access reads as "unavailable" and nothing is asked.
import { Platform } from "react-native";

export type CalendarAccess = "granted" | "denied" | "undetermined" | "unavailable";

type ExpoCalendar = typeof import("expo-calendar");

// Loaded lazily so the web demo and tests never load the native module.
function expoCalendar(): ExpoCalendar | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("expo-calendar") as ExpoCalendar;
  } catch (e) {
    console.warn("[calendarAccess] native module unavailable", e);
    return null;
  }
}

// Both permissions together: the widget shows events and reminders side by side.
export function combineAccess(calendar: CalendarAccess, reminders: CalendarAccess): CalendarAccess {
  if (calendar === "granted" && reminders === "granted") return "granted";
  if (calendar === "denied" || reminders === "denied") return "denied";
  if (calendar === "unavailable" || reminders === "unavailable") return "unavailable";
  return "undetermined";
}

function toAccess(response: { granted: boolean; canAskAgain: boolean }): CalendarAccess {
  if (response.granted) return "granted";
  return response.canAskAgain ? "undetermined" : "denied";
}

// What iOS allows right now, without showing a prompt.
export async function getCalendarAccess(): Promise<CalendarAccess> {
  const Calendar = expoCalendar();
  if (!Calendar) return "unavailable";
  const [calendar, reminders] = await Promise.all([
    Calendar.getCalendarPermissionsAsync(),
    Calendar.getRemindersPermissionsAsync(),
  ]);
  return combineAccess(toAccess(calendar), toAccess(reminders));
}

// Asks for Calendar, then Reminders; each prompt shows only once.
export async function requestCalendarAccess(): Promise<CalendarAccess> {
  const Calendar = expoCalendar();
  if (!Calendar) return "unavailable";
  const calendar = await Calendar.requestCalendarPermissionsAsync();
  const reminders = await Calendar.requestRemindersPermissionsAsync();
  const access = combineAccess(toAccess(calendar), toAccess(reminders));
  console.log(`[calendarAccess] access after asking: ${access}`);
  return access;
}
