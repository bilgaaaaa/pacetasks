// Wording for the alerts at the end of a timer. The widget's own Focus alert says the same in
// targets/deskfocus/_shared/FocusNotifier.swift, so keep the two in step.
import { ReminderText } from "./reminderCopy";

// The Focus session ran to its end (used where the shared native session is not available).
export function focusTimeUpCopy(taskTitle: string): ReminderText {
  return { title: "Focus time is up", body: `${taskTitle} — mark it done or start another round.` };
}

// The range timer reached the longest this task usually takes.
export function rangeTimeUpCopy(taskTitle: string, maxMinutes: number): ReminderText {
  return { title: "Time's up", body: `${taskTitle} reached its usual ${maxMinutes} min. Done?` };
}
