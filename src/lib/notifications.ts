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

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Makes the phone's scheduled reminders match the plan: everything this app
// scheduled before is replaced. `askPermission: false` is for background
// re-plans: it schedules only if notifications are already allowed.
export async function syncReminders(
  reminders: PlannedReminder[],
  { askPermission = true }: { askPermission?: boolean } = {}
): Promise<void> {
  if (!isSupported) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
  if (reminders.length === 0) return;

  const granted = askPermission
    ? await requestNotificationPermission()
    : (await Notifications.getPermissionsAsync()).granted;
  if (!granted) return;

  for (const reminder of reminders) {
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
  }
  console.log(`[notifications] ${reminders.length} reminder(s) scheduled`);
}
