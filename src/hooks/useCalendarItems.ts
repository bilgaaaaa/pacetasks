import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { completeCalendarReminder, fetchCalendarItems, onFocusBridgeChange } from "../lib/deskfocusBridge";
import { CalendarItem } from "../lib/calendarItems";

// The shown day's calendar events and reminders while `enabled` (the Today calendar button is on and access is
// granted). Reloaded when the day changes, when the app returns and whenever the widget changes something.
export function useCalendarItems(dayKey: string, enabled: boolean) {
  // Kept with the day they belong to, so another day's items never show while the new day loads.
  const [loaded, setLoaded] = useState<{ dayKey: string; items: CalendarItem[] } | null>(null);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    if (!enabled) {
      setLoaded(null);
      return;
    }
    const items = await fetchCalendarItems(dayKey);
    // A newer day or reload has started meanwhile; its answer wins.
    if (request !== latestRequest.current) return;
    if (items) setLoaded({ dayKey, items });
  }, [dayKey, enabled]);

  useEffect(() => {
    void reload();
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    const unsubscribe = onFocusBridgeChange(() => void reload());
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [reload, enabled]);

  // The reminder leaves the list at once; a failed save brings it back with the next load.
  const complete = useCallback(
    async (item: CalendarItem) => {
      if (!item.reminderId) return;
      setLoaded((current) => current && { ...current, items: current.items.filter((other) => other.id !== item.id) });
      const saved = await completeCalendarReminder(item.reminderId);
      console.log(`[useCalendarItems] reminder ${saved ? "completed" : "not completed"}`);
      if (!saved) await reload();
    },
    [reload]
  );

  const items = loaded?.dayKey === dayKey ? loaded.items : [];
  return { items, complete };
}
