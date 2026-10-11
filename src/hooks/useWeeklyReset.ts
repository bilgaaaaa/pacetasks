import { useCallback, useEffect, useMemo, useState } from "react";
import { toLocalDateKey } from "@domain/dates";
import {
  countResetReasons,
  keepResetTask,
  keptIdsThisWeek,
  resetOutcome,
  resetPatch,
  selectResetItems,
} from "@domain/weeklyReset";
import type { KeptResetTasks, ResetAction } from "@domain/weeklyReset";
import { Task, TaskPatch } from "../lib/types";
import { currentItem, recordDecision, sessionPhase, startSession, WeeklyResetSession } from "../lib/weeklyResetState";
import { loadKeptResetTasks, saveKeptResetTasks } from "../lib/weeklyResetStorage";

interface Options {
  tasks: Task[];
  onUpdate: (taskId: string, patch: TaskPatch) => Promise<boolean>; // both resolve false when saving failed
  onRemove: (taskId: string) => Promise<boolean>;
}

// Drives Weekly Reset: finds the tasks worth a decision, then walks through them
// one at a time. Each decision is saved as it is made, so closing halfway keeps
// everything decided so far. Transitions live in weeklyResetState. A task kept
// as it is stays out of the reset until next week (weeklyResetStorage).
export function useWeeklyReset({ tasks, onUpdate, onRemove }: Options) {
  const [session, setSession] = useState<WeeklyResetSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [kept, setKept] = useState<KeptResetTasks | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false); // avoids offering kept tasks before we know they were kept

  useEffect(() => {
    let active = true;
    loadKeptResetTasks().then((stored) => {
      if (!active) return;
      setKept(stored);
      setStorageLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const todayKey = toLocalDateKey(new Date());
  const pendingItems = useMemo(
    () => (storageLoaded ? selectResetItems(tasks, todayKey, { keptIds: keptIdsThisWeek(kept, todayKey) }) : []),
    [storageLoaded, tasks, todayKey, kept]
  );
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
      if (action === "keep") {
        const nextKept = keepResetTask(kept, liveTask.id, todayKey);
        setKept(nextKept);
        saveKeptResetTasks(nextKept);
      }
      setSession((current) => (current ? recordDecision(current, resetOutcome(action)) : current));
    },
    [item, saving, tasks, todayKey, kept, onUpdate, onRemove]
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
