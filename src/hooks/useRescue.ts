import { useCallback, useEffect, useMemo, useState } from "react";
import { toLocalDateKey } from "@domain/dates";
import { DO_NOW_DEFAULT_ENERGY } from "@domain/doNow";
import type { PaceModel } from "@domain/pace";
import { planRescue } from "@domain/rescue";
import { rolloverPatch } from "@domain/rollover";
import type { RolloverDestination } from "@domain/rollover";
import type { MoveChoice } from "../components/MoveTasksCard";
import { getCurrentTimeOfDay, getCurrentTiming } from "../lib/deviceContext";
import { loadRescueDismissedDay, saveRescueDismissedDay } from "../lib/rescueStorage";
import { Task, TaskChange } from "../lib/types";

interface Options {
  tasks: Task[];
  paceModel: PaceModel;
  workStartHour: number;
  workEndHour: number;
  onApply: (changes: TaskChange[]) => Promise<boolean>; // resolves false when saving failed
}

// Drives Rescue my day: when today's tasks no longer fit the time left, proposes
// what to keep and what to move, lets the user change any destination, and applies
// the moves in one tap. "Not now" hides it until tomorrow.
export function useRescue({ tasks, paceModel, workStartHour, workEndHour, onApply }: Options) {
  const [overrides, setOverrides] = useState<Record<string, RolloverDestination>>({});
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false); // avoids flashing the card before we know it was dismissed
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadRescueDismissedDay().then((day) => {
      if (!active) return;
      setDismissedDay(day);
      setStorageLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // "Now" always comes from the phone; recomputed on every render like the Today list.
  const todayKey = toLocalDateKey(new Date());
  const timeOfDay = getCurrentTimeOfDay();
  const currentTiming = getCurrentTiming(workStartHour, workEndHour);

  const plan = useMemo(
    () => planRescue(tasks, { todayKey, timeOfDay, currentTiming, energy: DO_NOW_DEFAULT_ENERGY, paceModel }),
    [tasks, todayKey, timeOfDay, currentTiming, paceModel]
  );
  const choices: MoveChoice[] = useMemo(
    () =>
      plan.proposals.map((proposal) => {
        const override = overrides[proposal.task.id];
        return override && override !== proposal.destination
          ? { task: proposal.task, destination: override, reason: null }
          : proposal;
      }),
    [plan, overrides]
  );
  const moveCount = choices.filter((choice) => choice.destination !== "today").length;
  const visible = storageLoaded && plan.behind && moveCount > 0 && dismissedDay !== todayKey;

  const setDestination = useCallback((taskId: string, destination: RolloverDestination) => {
    setOverrides((prev) => ({ ...prev, [taskId]: destination }));
  }, []);

  // Only moves are written: a task kept for today is left exactly as it is.
  const apply = useCallback(async () => {
    const moves = choices.filter((choice) => choice.destination !== "today");
    if (saving || moves.length === 0) return;
    setSaving(true);
    const changes = moves.map((choice) => ({
      taskId: choice.task.id,
      patch: rolloverPatch(choice.task, choice.destination, todayKey),
    }));
    const saved = await onApply(changes);
    setSaving(false);
    console.log(`[useRescue] moved ${changes.length} task(s), saved=${saved}`);
    // On failure the unmoved tasks stay on the card with the destinations the user chose, ready to retry.
    if (saved) setOverrides({});
  }, [saving, choices, todayKey, onApply]);

  const dismiss = useCallback(() => {
    setDismissedDay(todayKey);
    saveRescueDismissedDay(todayKey);
  }, [todayKey]);

  return {
    visible,
    choices,
    moveCount,
    minutesLeft: plan.minutesLeft,
    minutesPlanned: plan.minutesPlanned,
    saving,
    setDestination,
    apply,
    dismiss,
  };
}
