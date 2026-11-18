import { t } from "../i18n";

// UI copy for Rescue my day. Rules live in @domain/rescue; wording lives here so
// it follows the app's language without touching the logic.

// "45 min", "1 h", "2 h 15 min".
export function durationLabel(minutes: number): string {
  if (minutes < 60) return t("{0} min", minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t("{0} h", hours) : t("{0} h {1} min", hours, rest);
}

// The collapsed row: "Running behind · 3 tasks to move".
export function rescueSummary(moveCount: number): string {
  return moveCount === 1 ? t("Running behind · 1 task to move") : t("Running behind · {0} tasks to move", moveCount);
}

// Opens the review: what's left against what's planned, at the user's pace.
export function rescueSubtitle(minutesLeft: number, minutesPlanned: number): string {
  return t(
    "{0} left today, {1} planned. Here's what I'd keep and what I'd move. Change any, then apply.",
    durationLabel(minutesLeft),
    durationLabel(minutesPlanned)
  );
}
