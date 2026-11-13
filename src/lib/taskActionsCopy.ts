import type { DestructivePrompt } from "./confirmDestructive";
import { t } from "../i18n";

// Wording for actions offered on a single task outside the Today list
// (Someday, Upcoming), so both sheets ask and label things the same way.

// The question asked before a task is deleted for good.
export function deleteTaskPrompt(title: string): DestructivePrompt {
  return { title: t("Delete “{0}”?", title), message: t("This can't be undone."), confirmLabel: t("Delete") };
}

// "Work · ~15 min": the quiet detail line under a task's title.
export function taskDetailLine(categoryLabel: string | null, estimatedMinutes: number): string {
  return [categoryLabel, t("~{0} min", estimatedMinutes)].filter(Boolean).join(" · ");
}
