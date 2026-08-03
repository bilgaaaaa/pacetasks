import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_IDENTIFIER = "pacetasks-daily-reminder";

// Foreground notifications still show a banner + sound, matching what the
// user would expect from a background reminder.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Cancels any existing daily reminder and, if enabled, schedules a fresh one
// at the given "HH:MM" time. Called any time settings are saved so there is
// never more than one reminder scheduled at once.
export async function syncDailyReminder(
  enabled: boolean,
  time: string
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(
    () => {
      // No-op: nothing was scheduled yet, which is fine.
    }
  );

  if (!enabled) return;

  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: {
      title: "PaceTasks",
      body: "Got a minute? Check what's left on your list.",
      sound: Platform.OS === "ios" ? "default" : undefined,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}
