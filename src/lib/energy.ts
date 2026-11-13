import { ENERGY_LEVELS } from "@domain/task";
import { EnergyLevel } from "./types";
import { localized, msg, t } from "../i18n";

// Wording for energy levels, shared by "the energy I have right now" (What can
// I do now?) and "the energy a task needs" (the add sheet), so both read the same.
const ENERGY_NAMES: Record<EnergyLevel, string> = localized({
  low: msg("Low"),
  medium: msg("Normal"),
  high: msg("High"),
});

export const ANY_ENERGY_LABEL = msg("Any energy");

// One-word choices for a control that already says it is about energy.
// Each label is read when shown, so it follows the app's language.
export const ENERGY_OPTIONS: { value: EnergyLevel; label: string }[] = ENERGY_LEVELS.map((level) => ({
  value: level,
  get label() {
    return ENERGY_NAMES[level];
  },
}));

// The level inside a sentence: "low energy", "normal energy", "high energy".
const ENERGY_PHRASES: Record<EnergyLevel, string> = localized({
  low: msg("low energy"),
  medium: msg("normal energy"),
  high: msg("high energy"),
});

export function energyPhrase(level: EnergyLevel): string {
  return ENERGY_PHRASES[level];
}

// Full label for places without that context, e.g. "Low energy"; null means the task has none set.
export function energyLabel(level: EnergyLevel | null): string {
  return level ? t("{0} energy", ENERGY_NAMES[level]) : t(ANY_ENERGY_LABEL);
}
