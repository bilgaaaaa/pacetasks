import { useCallback, useEffect, useMemo, useState } from "react";
import { toLocalDateKey } from "@domain/dates";
import { proposeRollover, rolloverPatch } from "@domain/rollover";
import type { RolloverDestination, RolloverReason } from "@domain/rollover";
import { loadRolloverDismissedDay, saveRolloverDismissedDay } from "../lib/rolloverStorage";
import { Task, TaskChange } from "../lib/types";

// One row of the rollover card. `reason` is null once the user changed the destination.
export interface RolloverChoice {
  task: Task;
  destination: RolloverDestination;
  reason: RolloverReason | null;
}

interface Options {
  tasks: Task[];
  onApply: (changes: TaskChange[]) => Promise<boolean>; // resolves false when saving failed
}

// Drives the "I didn't do it" rollover card: proposes where each unfinished task
// goes, lets the user change any destination, and applies them all in one tap.
// "Not now" hides the card until tomorrow.
export function useRollover({ tasks, onApply }: Options) {
  const [overrides, setOverrides] = useState<Record<string, RolloverDestination>>({});
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false); // avoids flashing the card before we know it was dismissed
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadRolloverDismissedDay().then((day) => {
      if (!active) return;
      setDismissedDay(day);
      setStorageLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const todayKey = toLocalDateKey(new Date());
  const choices: RolloverChoice[] = useMemo(
    () =>
      proposeRollover(tasks, todayKey).map((proposal) => {
        const override = overrides[proposal.task.id];
        return override && override !== proposal.destination
          ? { task: proposal.task, destination: override, reason: null }
          : proposal;
      }),
    [tasks, todayKey, overrides]
  );
  const visible = storageLoaded && choices.length > 0 && dismissedDay !== todayKey;

  const setDestination = useCallback((taskId: string, destination: RolloverDestination) => {
    setOverrides((prev) => ({ ...prev, [taskId]: destination }));
  }, []);

  const apply = useCallback(async () => {
    if (saving || choices.length === 0) return;
    setSaving(true);
    const changes = choices.map((choice) => ({
      taskId: choice.task.id,
      patch: rolloverPatch(choice.task, choice.destination, todayKey),
    }));
    const saved = await onApply(changes);
    setSaving(false);
    // On failure the unmoved tasks stay on the card with the destinations the user chose, ready to retry.
    if (saved) setOverrides({});
  }, [saving, choices, todayKey, onApply]);

  const dismiss = useCallback(() => {
    setDismissedDay(todayKey);
    saveRolloverDismissedDay(todayKey);
  }, [todayKey]);

  return { visible, choices, saving, setDestination, apply, dismiss };
}
