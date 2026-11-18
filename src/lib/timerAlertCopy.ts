// Wording for the alerts at the end of a timer. The widget's own Focus alert says the same in
// targets/deskfocus/_shared/FocusNotifier.swift, so keep the two in step.
import { ReminderText } from "./reminderCopy";
import { t } from "../i18n";

// The Focus session ran to its end (used where the shared native session is not available).
export function focusTimeUpCopy(taskTitle: string): ReminderText {
  return { title: t("Focus time is up"), body: t("{0} — mark it done or start another round.", taskTitle) };
}

// The range timer reached the longest this task usually takes.
export function rangeTimeUpCopy(taskTitle: string, maxMinutes: number): ReminderText {
  return { title: t("Time's up"), body: t("{0} reached its usual {1} min. Done?", taskTitle, maxMinutes) };
}
