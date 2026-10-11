import { useCallback } from "react";
import { HapticCue, isHapticEnabled, playHaptic } from "../lib/haptics";
import { DEFAULT_SETTINGS } from "../lib/settingsApi";
import { useSettings } from "./useSettings";

// Vibration feedback that follows the user's settings. Every component asks for
// a cue through this hook, so a switch in Settings really silences its cue.
export function useHaptics() {
  const { settings } = useSettings();
  const hapticsEnabled = settings?.haptics_enabled ?? DEFAULT_SETTINGS.haptics_enabled;
  const timerChimeEnabled = settings?.timer_chime_enabled ?? DEFAULT_SETTINGS.timer_chime_enabled;

  const play = useCallback(
    (cue: HapticCue) => {
      if (isHapticEnabled(cue, { haptics_enabled: hapticsEnabled, timer_chime_enabled: timerChimeEnabled })) {
        playHaptic(cue);
      }
    },
    [hapticsEnabled, timerChimeEnabled]
  );

  return { play };
}
