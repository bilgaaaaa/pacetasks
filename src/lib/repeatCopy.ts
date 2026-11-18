import { REPEAT_RULES } from "@domain/repeat";
import type { RepeatRule } from "@domain/repeat";
import { localized, msg, t } from "../i18n";

// UI copy for repeating tasks. Rules live in @domain/repeat; wording lives here.

const REPEAT_LABELS: Record<RepeatRule, string> = localized({
  daily: msg("Every day"),
  weekdays: msg("Weekdays"),
  weekly: msg("Every week"),
  monthly: msg("Every month"),
});

// The choices in the add sheet's Day panel; null = does not repeat.
export const REPEAT_CHOICES: (RepeatRule | null)[] = [null, ...REPEAT_RULES];

export function repeatChoiceLabel(rule: RepeatRule | null): string {
  return rule ? REPEAT_LABELS[rule] : t("Doesn't repeat");
}

// Short tag on a task row and the Day row: "↻ Every week".
export function repeatTag(rule: RepeatRule): string {
  return `↻ ${REPEAT_LABELS[rule]}`;
}
