import * as Haptics from "expo-haptics";
import { UserSettings } from "./types";

// The moments the app answers with a vibration. Add a new one here, never by
// calling expo-haptics from a component: this file is its only caller.
export type HapticCue = "taskCompleted" | "timerEnded";

type HapticSettings = Pick<UserSettings, "haptics_enabled" | "timer_chime_enabled">;

// The setting that switches each cue on or off. The timer's buzz keeps its older
// field name (timer_chime_enabled), from when it was meant to be a sound.
const CUE_SETTING: Record<HapticCue, keyof HapticSettings> = {
  taskCompleted: "haptics_enabled",
  timerEnded: "timer_chime_enabled",
};

// Whether the user's settings allow a cue to play.
export function isHapticEnabled(cue: HapticCue, settings: HapticSettings): boolean {
  return settings[CUE_SETTING[cue]];
}

const PLAYERS: Record<HapticCue, () => Promise<void>> = {
  taskCompleted: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  timerEnded: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

// Plays a cue. A phone or browser without a vibration motor is not an error worth showing.
export function playHaptic(cue: HapticCue): void {
  PLAYERS[cue]().catch((e) => console.warn(`[haptics] ${cue} failed`, e));
}
