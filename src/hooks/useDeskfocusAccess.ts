import { useCallback } from "react";
import { requestNotificationPermission } from "../lib/notifications";
import { useCalendarAccess } from "./useCalendarAccess";
import { useNotificationPermission } from "./useNotificationPermission";

// What the DeskFocus widget needs from iOS: Calendar and Reminders, which it reads with the app's permission, and
// notifications, which its focus timer alerts through. `allow` asks for all of them in one go.
export function useDeskfocusAccess() {
  const calendarAccess = useCalendarAccess();
  const notifications = useNotificationPermission();
  const needsAccess = calendarAccess.access === "undetermined" || notifications.permission === "undetermined";

  const allow = useCallback(async () => {
    await calendarAccess.request();
    await requestNotificationPermission().catch((e) => console.warn("[useDeskfocusAccess] permission request failed", e));
    notifications.refresh();
  }, [calendarAccess.request, notifications.refresh]);

  return { access: calendarAccess.access, needsAccess, allow };
}
