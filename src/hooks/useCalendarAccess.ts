import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { CalendarAccess } from "../lib/calendarAccess";
import { fetchCalendarAccess, requestCalendarAccessFromBridge } from "../lib/deskfocusBridge";

// Calendar and Reminders access, re-read whenever the app returns (the user may have changed it in the phone's
// Settings). `request` shows iOS' prompts and returns the access afterwards; the widget redraws with it.
export function useCalendarAccess() {
  const [access, setAccess] = useState<CalendarAccess>("unavailable");

  const refresh = useCallback(() => {
    fetchCalendarAccess()
      .then(setAccess)
      .catch((e) => console.warn("[useCalendarAccess] could not read access", e));
  }, []);

  const request = useCallback(async (): Promise<CalendarAccess> => {
    const granted = await requestCalendarAccessFromBridge();
    setAccess(granted);
    console.log(`[useCalendarAccess] access after asking: ${granted}`);
    return granted;
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
