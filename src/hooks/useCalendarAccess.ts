import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { CalendarAccess, getCalendarAccess, requestCalendarAccess } from "../lib/calendarAccess";
import { reloadWidget } from "../lib/deskfocusWidgetStorage";

// Calendar and Reminders access for the Deskfocus widget, re-read whenever the app returns
// (the user may have changed it in the phone's Settings). The widget redraws once access changes.
export function useCalendarAccess() {
  const [access, setAccess] = useState<CalendarAccess>("unavailable");

  const refresh = useCallback(() => {
    getCalendarAccess()
      .then(setAccess)
      .catch((e) => console.warn("[useCalendarAccess] could not read access", e));
  }, []);

  const request = useCallback(async () => {
    try {
      setAccess(await requestCalendarAccess());
      reloadWidget();
    } catch (e) {
      console.warn("[useCalendarAccess] request failed", e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { access, request };
}
