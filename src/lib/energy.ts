import { ENERGY_LEVELS } from "@domain/task";
import { EnergyLevel } from "./types";

// Wording for energy levels, shared by "the energy I have right now" (What can
// I do now?) and "the energy a task needs" (quick add), so both read the same.
const ENERGY_NAMES: Record<EnergyLevel, string> = {
  low: "Low",
  medium: "Normal",
  high: "High",
};

export const ANY_ENERGY_LABEL = "Any energy";

// One-word choices for a control that already says it is about energy.
export const ENERGY_OPTIONS: { value: EnergyLevel; label: string }[] = ENERGY_LEVELS.map((level) => ({
  value: level,
  label: ENERGY_NAMES[level],
}));

// Full label for places without that context, e.g. "Low energy"; null means the task has none set.
export function energyLabel(level: EnergyLevel | null): string {
  return level ? `${ENERGY_NAMES[level]} energy` : ANY_ENERGY_LABEL;
}
