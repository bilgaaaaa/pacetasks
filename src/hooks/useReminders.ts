import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { Task } from "../lib/types";
import { syncReminders } from "../lib/notifications";
import { planReminders } from "../lib/reminderPlan";
import { useSettings } from "./useSettings";

const REPLAN_DELAY_MS = 1500; // lets a burst of task changes settle into one re-plan

// Keeps the phone's reminders in step with the tasks and the reminder settings.
// Permission is asked the first time there is something to remind about, never on a cold start.
export function useReminders(tasks: Task[], tasksLoading: boolean) {
  const { settings } = useSettings();
  const reminderEnabled = settings?.reminder_enabled;
  const reminderTime = settings?.reminder_time;
  const taskReminderEnabled = settings?.task_reminder_enabled;

  const replan = useCallback(() => {
    if (reminderEnabled === undefined || reminderTime === undefined) return;
    const reminders = planReminders(
      tasks,
      // A database not yet migrated has no task_reminder_enabled: treat it as on, its default.
      { reminder_enabled: reminderEnabled, reminder_time: reminderTime, task_reminder_enabled: taskReminderEnabled ?? true },
      new Date()
    );
    syncReminders(reminders, { askPermission: reminders.length > 0 }).catch((e) =>
      console.warn("[useReminders] re-plan failed", e)
    );
  }, [tasks, reminderEnabled, reminderTime, taskReminderEnabled]);

  useEffect(() => {
    if (tasksLoading) return;
    const timer = setTimeout(replan, REPLAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [replan, tasksLoading]);

  // A new day (or hours in the background) changes what is still ahead.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !tasksLoading) replan();
    });
    return () => subscription.remove();
  }, [replan, tasksLoading]);
}
