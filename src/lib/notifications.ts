import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { PlannedReminder, REMINDER_ID_PREFIX } from "./reminderPlan";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const isSupported = Platform.OS !== "web"; // browsers have no scheduled local notifications
const MIN_LEAD_MS = 5000; // iOS rejects a moment that has passed by the time it is scheduled

export type NotificationPermission = "granted" | "denied" | "undetermined";

// What iOS currently allows, without ever showing the permission prompt.
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!isSupported) return "undetermined";
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  return current.canAskAgain ? "undetermined" : "denied";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function cancelScheduledReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

// Runs happen one after another and only the newest plan counts, so an older
// run can never bring back a reminder that a newer one removed.
let latestRun = 0;
let queue: Promise<void> = Promise.resolve();

// Makes the phone's scheduled reminders match the plan: everything this app
// scheduled before is replaced. `askPermission: false` is for background
// re-plans: it schedules only if notifications are already allowed.
export function syncReminders(
  reminders: PlannedReminder[],
  { askPermission = true }: { askPermission?: boolean } = {}
): Promise<void> {
  if (!isSupported) return Promise.resolve();
  const run = ++latestRun;
  const isSuperseded = () => run !== latestRun;

  queue = queue
    .then(async () => {
      if (isSuperseded()) return;
      await cancelScheduledReminders();
      if (reminders.length === 0) return;

      const granted = askPermission
        ? await requestNotificationPermission()
        : (await Notifications.getPermissionsAsync()).granted;
      if (!granted) return;

      let scheduled = 0;
      for (const reminder of reminders) {
        if (isSuperseded()) return;
        if (reminder.at.getTime() - Date.now() < MIN_LEAD_MS) continue;
        try {
          await Notifications.scheduleNotificationAsync({
            identifier: reminder.id,
            content: {
              title: reminder.title,
              body: reminder.body,
              // Only a task about to start makes a sound; the daily check-in stays silent.
              sound: reminder.kind === "task" ? "default" : false,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
          });
          scheduled++;
        } catch (e) {
          console.warn(`[notifications] could not schedule ${reminder.id}`, e);
        }
      }
      console.log(`[notifications] ${scheduled} reminder(s) scheduled`);
    })
    .catch((e) => console.warn("[notifications] reminder sync failed", e));
  return queue;
}
