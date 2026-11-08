import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { toLocalDateKey } from "@domain/dates";
import { onFocusBridgeChange } from "../lib/deskfocusBridge";
import { completionsToApply, parseWidgetCompletions, widgetPaceTasks } from "../lib/deskfocusWidget";
import { readWidgetCompletions, writeWidgetTasks } from "../lib/deskfocusWidgetStorage";
import { Task } from "../lib/types";

const WRITE_DELAY_MS = 500; // lets a burst of task changes settle into one widget update

// Keeps the Deskfocus widget in step with PaceTasks: writes today's tasks whenever they change and, when the app
// comes to the front or the widget changes something, completes the tasks checked off in the widget. `tasksReady` is false while tasks are loading
// or failed to load, so an empty list that is not real never empties the widget.
export function useDeskfocusWidget(
  tasks: Task[],
  tasksReady: boolean,
  complete: (taskId: string, actualMinutes: number | null) => Promise<boolean>
) {
  const applying = useRef(false);

  useEffect(() => {
    if (!tasksReady) return;
    const timer = setTimeout(() => writeWidgetTasks(widgetPaceTasks(tasks, toLocalDateKey(new Date()))), WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tasks, tasksReady]);

  // Completed tasks leave the list on the next write, which tells the widget they are settled.
  const applyWidgetCompletions = useCallback(async () => {
    if (!tasksReady || applying.current) return;
    const ids = completionsToApply(parseWidgetCompletions(readWidgetCompletions()), tasks);
    if (ids.length === 0) return;
    applying.current = true;
    console.log(`[useDeskfocusWidget] completing ${ids.length} tasks checked off in the widget`);
    try {
      // The widget does not time a check-off, so the real minutes are unknown.
      for (const id of ids) await complete(id, null);
    } finally {
      applying.current = false;
    }
  }, [tasks, tasksReady, complete]);

  // Also on every change from the widget or the Live Activity, so a ✓ pressed while the app is open is saved at once.
  useEffect(() => {
    applyWidgetCompletions();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") applyWidgetCompletions();
    });
    const unsubscribe = onFocusBridgeChange(() => void applyWidgetCompletions());
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [applyWidgetCompletions]);
}
