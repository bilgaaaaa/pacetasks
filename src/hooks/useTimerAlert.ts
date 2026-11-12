import { useCallback } from "react";
import { cancelTimerAlert, scheduleTimerAlert } from "../lib/notifications";
import { ReminderText } from "../lib/reminderCopy";
import { DEFAULT_SETTINGS } from "../lib/settingsApi";
import { useSettings } from "./useSettings";

// The alert at the end of a JS timer (range timer, or Focus where the shared native session is missing).
// It plays a sound only while the user's timer sound setting is on, the same switch as the timer's buzz.
export function useTimerAlert() {
  const { settings } = useSettings();
  const playsSound = settings?.timer_chime_enabled ?? DEFAULT_SETTINGS.timer_chime_enabled;

  const schedule = useCallback(
    (key: string, durationSeconds: number, copy: ReminderText) => {
      void scheduleTimerAlert({ key, at: new Date(Date.now() + durationSeconds * 1000), playsSound, ...copy });
    },
    [playsSound]
  );

  const cancel = useCallback((key: string) => {
    void cancelTimerAlert(key);
  }, []);

  return { schedule, cancel };
}
