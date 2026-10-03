import { useMemo, useState } from "react";
import { toLocalDateKey } from "@domain/dates";
import { DO_NOW_DEFAULT_ENERGY, DO_NOW_DEFAULT_MINUTES, selectDoNowTasks } from "@domain/doNow";
import { isPendingToday } from "@domain/todayTasks";
import { getCurrentTiming } from "../lib/deviceContext";
import { EnergyLevel, Task } from "../lib/types";

// Drives "What can I do now?": remembers the time and energy the user picked
// (for as long as the app stays open) and keeps the suggestions in step with
// the live task list, so finishing a task immediately brings up the next one.
export function useDoNow(tasks: Task[], workStartHour: number, workEndHour: number) {
  const [availableMinutes, setAvailableMinutes] = useState<number>(DO_NOW_DEFAULT_MINUTES);
  const [energy, setEnergy] = useState<EnergyLevel>(DO_NOW_DEFAULT_ENERGY);

  // "Now" always comes from the phone; recomputed on every render like the Today list.
  const todayKey = toLocalDateKey(new Date());
  const currentTiming = getCurrentTiming(workStartHour, workEndHour);

  const selection = useMemo(
    () => selectDoNowTasks(tasks, { todayKey, availableMinutes, energy, currentTiming }),
    [tasks, todayKey, availableMinutes, energy, currentTiming]
  );
  const hasPendingToday = useMemo(
    () => tasks.some((task) => isPendingToday(task, todayKey)),
    [tasks, todayKey]
  );

  return { availableMinutes, energy, selection, hasPendingToday, setAvailableMinutes, setEnergy };
}
