import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Task } from "../lib/types";
import { syncReminders } from "../lib/notifications";
import { planReminders } from "../lib/reminderPlan";
import { useSettings } from "./useSettings";

const REPLAN_DELAY_MS = 1500; // lets a burst of task changes settle into one re-plan

// Keeps the phone's reminders in step with the user's tasks and reminder settings.
// `tasksReady` is false while the tasks are loading or could not be loaded, so an
// empty list that is not real never wipes the reminders. Permission is asked only
// right after the user adds a task, never on a cold start.
export function useReminders(userId: string | undefined, tasks: Task[], tasksReady: boolean) {
  const { settings } = useSettings();
  const reminderEnabled = settings?.reminder_enabled;
  const reminderTime = settings?.reminder_time;
  const taskReminderEnabled = settings?.task_reminder_enabled;
  const lastOpenCount = useRef<number | null>(null); // open tasks at the previous re-plan; null before the first

  const replan = useCallback(() => {
    if (!tasksReady || reminderEnabled === undefined || reminderTime === undefined) return;
    const reminders = planReminders(
      tasks,
      // A database not yet migrated has no task_reminder_enabled: treat it as on, its default.
      { reminder_enabled: reminderEnabled, reminder_time: reminderTime, task_reminder_enabled: taskReminderEnabled ?? true },
      new Date()
    );
    const openCount = tasks.filter((task) => task.status === "pending").length;
    const taskAdded = lastOpenCount.current !== null && openCount > lastOpenCount.current;
    lastOpenCount.current = openCount;
    syncReminders(reminders, { askPermission: taskAdded && reminders.length > 0 });
  }, [tasks, tasksReady, reminderEnabled, reminderTime, taskReminderEnabled]);

  useEffect(() => {
    const timer = setTimeout(replan, REPLAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [replan]);

  // A new day (or hours in the background) changes what is still ahead.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") replan();
    });
    return () => subscription.remove();
  }, [replan]);

  // When the user changes (sign-out, sign-in, account deletion), the previous
  // user's reminders go at once: their task titles must not show up for someone else.
  useEffect(() => {
    lastOpenCount.current = null;
    return () => {
      if (userId) syncReminders([], { askPermission: false });
    };
  }, [userId]);
}
