import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform } from "react-native";

// iOS reports when a sheet has gone (Modal's onDismiss), so the timer there is only
// a safety net; Android and web don't report it, so they wait out the animation.
const HANDOFF_FALLBACK_MS = Platform.OS === "ios" ? 1200 : 350;

// Opens one sheet from inside another. iOS can't present a sheet while the
// previous one is still sliding away: asked too early it silently shows nothing,
// so the next sheet opens only once the first reports that it is gone.
export function useSheetHandoff() {
  const pendingOpen = useRef<(() => void) | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
  };

  // Pass this to the closing sheet's Modal as onDismiss.
  const onDismissed = useCallback(() => {
    clearFallback();
    const open = pendingOpen.current;
    pendingOpen.current = null;
    open?.();
  }, []);

  // Closes the current sheet and opens the next one once it is gone.
  const handOff = useCallback(
    (close: () => void, open: () => void) => {
      Keyboard.dismiss(); // an open keyboard makes the closing sheet take longer
      pendingOpen.current = open;
      close();
      clearFallback();
      fallbackTimer.current = setTimeout(onDismissed, HANDOFF_FALLBACK_MS);
    },
    [onDismissed]
  );

  useEffect(() => clearFallback, []);

  return { handOff, onDismissed };
}
