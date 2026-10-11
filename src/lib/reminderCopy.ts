import { Task } from "./types";

export interface ReminderText {
  title: string;
  body: string;
}

const minutesLabel = (minutes: number) => `${minutes} min`;

// The daily check-in: says what is really left, and points at the easiest way in.
export function checkInCopy(open: Task[]): ReminderText {
  const quickest = open.reduce((best, task) => (task.estimated_minutes < best.estimated_minutes ? task : best));
  if (open.length === 1) {
    return { title: "One thing left today", body: `${quickest.title}, about ${minutesLabel(quickest.estimated_minutes)}.` };
  }
  return {
    title: `${open.length} things left today`,
    body: `The quickest is ${quickest.title}, about ${minutesLabel(quickest.estimated_minutes)}.`,
  };
}

// The heads-up before a task with a fixed start time.
export function taskReminderCopy(task: Task, leadMinutes: number): ReminderText {
  return { title: task.title, body: `Starts in ${leadMinutes} minutes.` };
}

// Settings wording for the reminders section.
export const REMINDERS_SECTION_LABEL = "REMINDERS";
export const CHECK_IN_TITLE = "Daily check-in";
export const checkInSubtitle = (time: string) => `One quiet nudge at ${time}, only if tasks are still open`;
export const TASK_REMINDER_TITLE = "Before a timed task";
export const taskReminderSubtitle = (leadMinutes: number) =>
  `${leadMinutes} minutes before a task with a start time`;
