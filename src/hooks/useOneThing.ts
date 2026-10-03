import { useCallback, useMemo, useRef, useState } from "react";
import { toLocalDateKey } from "@domain/dates";
import { selectOneThingQueue } from "@domain/doNow";
import { getCurrentTiming } from "../lib/deviceContext";
import { EnergyLevel, Task } from "../lib/types";

export type OneThingPhase = "choosing" | "confirming" | "completed";

interface Options {
  tasks: Task[];
  energy: EnergyLevel; // the energy last picked in "What can I do now?"; it only shapes the order
  workStartHour: number;
  workEndHour: number;
  onComplete: (taskId: string, actualMinutes: number) => Promise<boolean>; // resolves false when saving failed
}

// Drives One Thing mode: always exactly one task on screen, the best one to do
// right now. "Not now" passes on it for this session; completing it logs the
// real minutes, then offers the next one.
export function useOneThing({ tasks, energy, workStartHour, workEndHour, onComplete }: Options) {
  const [skippedTaskIds, setSkippedTaskIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmingTask, setConfirmingTask] = useState<Task | null>(null); // pinned so a live list update can't swap it mid-confirm
  const [minutes, setMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completedTitle, setCompletedTitle] = useState<string | null>(null);
  const visitRef = useRef(0); // bumped on reset, so a save that finishes after the sheet closed is ignored

  const todayKey = toLocalDateKey(new Date());
  const currentTiming = getCurrentTiming(workStartHour, workEndHour);
  const queue = useMemo(
    () => selectOneThingQueue(tasks, { todayKey, energy, currentTiming }, skippedTaskIds),
    [tasks, todayKey, energy, currentTiming, skippedTaskIds]
  );
  const task = queue[0] ?? null;
  const phase: OneThingPhase = completedTitle !== null ? "completed" : confirmingTask ? "confirming" : "choosing";

  const skip = useCallback(() => {
    if (task) setSkippedTaskIds((prev) => new Set(prev).add(task.id));
  }, [task]);

  const resetSkipped = useCallback(() => setSkippedTaskIds(new Set()), []);

  const startConfirm = useCallback(() => {
    if (!task) return;
    setMinutes(task.estimated_minutes);
    setConfirmingTask(task);
  }, [task]);

  const cancelConfirm = useCallback(() => setConfirmingTask(null), []);

  const confirm = useCallback(async () => {
    if (!confirmingTask || saving) return;
    const visit = visitRef.current;
    setSaving(true);
    const saved = await onComplete(confirmingTask.id, minutes);
    setSaving(false);
    if (!saved || visit !== visitRef.current) return; // on failure the sheet shows the error; stay here to retry
    setCompletedTitle(confirmingTask.title);
    setConfirmingTask(null);
  }, [confirmingTask, minutes, saving, onComplete]);

  const next = useCallback(() => setCompletedTitle(null), []);

  // Closing the sheet starts the next visit fresh: nothing skipped, nothing half-confirmed.
  const reset = useCallback(() => {
    visitRef.current += 1;
    setSkippedTaskIds(new Set());
    setConfirmingTask(null);
    setCompletedTitle(null);
  }, []);

  return {
    phase,
    task: confirmingTask ?? task,
    remainingCount: Math.max(0, queue.length - 1),
    skippedCount: skippedTaskIds.size,
    minutes,
    saving,
    completedTitle,
    todayKey,
    setMinutes,
    skip,
    resetSkipped,
    startConfirm,
    cancelConfirm,
    confirm,
    next,
    reset,
  };
}
