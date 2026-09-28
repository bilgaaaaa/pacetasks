import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_IDENTIFIER = "pacetasks-daily-reminder";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
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
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
