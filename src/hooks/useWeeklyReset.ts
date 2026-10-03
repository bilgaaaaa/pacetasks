import { useCallback, useMemo, useState } from "react";
import { toLocalDateKey } from "@domain/dates";
import { countResetReasons, resetOutcome, resetPatch, selectResetItems } from "@domain/weeklyReset";
import type { ResetAction } from "@domain/weeklyReset";
import { Task, TaskPatch } from "../lib/types";
import { currentItem, recordDecision, sessionPhase, startSession, WeeklyResetSession } from "../lib/weeklyResetState";

interface Options {
  tasks: Task[];
  onUpdate: (taskId: string, patch: TaskPatch) => Promise<boolean>; // both resolve false when saving failed
  onRemove: (taskId: string) => Promise<boolean>;
}

// Drives Weekly Reset: finds the tasks worth a decision, then walks through them
// one at a time. Each decision is saved as it is made, so closing halfway keeps
// everything decided so far. Transitions live in weeklyResetState.
export function useWeeklyReset({ tasks, onUpdate, onRemove }: Options) {
  const [session, setSession] = useState<WeeklyResetSession | null>(null);
  const [saving, setSaving] = useState(false);

  const todayKey = toLocalDateKey(new Date());
  const pendingItems = useMemo(() => selectResetItems(tasks, todayKey), [tasks, todayKey]);
  const reasonCounts = useMemo(() => countResetReasons(pendingItems), [pendingItems]);
  const item = currentItem(session);

  const start = useCallback(() => setSession(startSession(pendingItems)), [pendingItems]);

  const decide = useCallback(
    async (action: ResetAction) => {
      if (!item || saving) return;
      // The run works on a snapshot: a task finished, parked or deleted elsewhere
      // since Start no longer needs a decision, so it is left exactly as it is.
      const liveTask = tasks.find((task) => task.id === item.task.id);
      if (!liveTask || liveTask.status !== "pending") {
        setSession((current) => (current ? recordDecision(current, "kept") : current));
        return;
      }

      const patch = resetPatch(liveTask, action, todayKey);
      setSaving(true);
      const saved =
        action === "delete" ? await onRemove(liveTask.id) : patch ? await onUpdate(liveTask.id, patch) : true;
      setSaving(false);
      if (!saved) return; // the sheet shows the error; stay on this task so the user can retry
      setSession((current) => (current ? recordDecision(current, resetOutcome(action)) : current));
    },
    [item, saving, tasks, todayKey, onUpdate, onRemove]
  );

  // Closing the sheet ends the run; the next one starts from a fresh look at the list.
  const reset = useCallback(() => setSession(null), []);

  return {
    phase: sessionPhase(session),
    pendingCount: pendingItems.length,
    reasonCounts,
    item,
    index: session?.index ?? 0,
    total: session?.items.length ?? 0,
    tally: session?.tally ?? null,
    saving,
    todayKey,
    start,
    decide,
    reset,
  };
}
