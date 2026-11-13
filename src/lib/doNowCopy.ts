import { DO_NOW_MINUTE_OPTIONS } from "@domain/doNow";
import { ENERGY_LEVELS } from "@domain/task";
import { energyPhrase } from "./energy";
import { EnergyLevel } from "./types";
import { t } from "../i18n";

// UI copy for "What can I do now?". Rules live in @domain/doNow; wording lives
// here so it can be localized later without touching the logic.

const LONGEST_OPTION_MINUTES = Math.max(...DO_NOW_MINUTE_OPTIONS);
const HIGHEST_ENERGY = ENERGY_LEVELS[ENERGY_LEVELS.length - 1];

// "5 min", "30 min", "1 hour": how a time choice reads on its chip.
export function minutesLabel(minutes: number): string {
  if (minutes % 60 !== 0) return t("{0} min", minutes);
  const hours = minutes / 60;
  return hours === 1 ? t("1 hour") : t("{0} hours", hours);
}

// Caption over the plan, e.g. "2 tasks · 13 of 15 min".
export function planSummary(taskCount: number, planMinutes: number, availableMinutes: number): string {
  const tasks = taskCount === 1 ? t("1 task") : t("{0} tasks", taskCount);
  return t("{0} · {1} of {2} min", tasks, planMinutes, availableMinutes);
}

// Shown when nothing fits: says whether the day is clear or what to change.
export function emptyMessage(hasPendingToday: boolean, availableMinutes: number, energy: EnergyLevel): string {
  if (!hasPendingToday) return t("Nothing left for today. Enjoy the free time.");
  if (availableMinutes >= LONGEST_OPTION_MINUTES && energy === HIGHEST_ENERGY) {
    return t("What's left today takes longer than {0} or has a fixed start time.", minutesLabel(availableMinutes));
  }
  return t("Nothing fits {0} at {1}. Try more time or more energy.", minutesLabel(availableMinutes), energyPhrase(energy));
}
