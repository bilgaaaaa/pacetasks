import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { countdownEndsAt, remainingSeconds as secondsUntil } from "../lib/countdown";

// Several checks per second keep the display within a fraction of a second of the clock.
const TICK_MS = 250;

// A countdown that survives the phone being locked: it remembers when it ends and
// reads the time left from the clock on every tick and whenever the app returns,
// instead of counting ticks (iOS runs none in the background). `onFinish` is
// called exactly once when a countdown reaches zero, never when it is stopped.
export function useCountdown(onFinish: () => void) {
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const endsAt = useRef<number | null>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;

  const sync = useCallback(() => {
    if (endsAt.current === null) return;
    const remaining = secondsUntil(endsAt.current, Date.now());
    setRemainingSeconds(remaining);
    if (remaining > 0) return;
    endsAt.current = null; // cleared first, so a second check can never finish it twice
    setIsRunning(false);
    console.log("[useCountdown] finished");
    finish.current();
  }, []);

  // Starts (or restarts) a countdown of `durationSeconds` from now.
  const start = useCallback((durationSeconds: number) => {
    endsAt.current = countdownEndsAt(Date.now(), durationSeconds);
    setRemainingSeconds(Math.max(0, durationSeconds));
    setIsRunning(true);
  }, []);

  // Stops without finishing; the time left stays readable for the caller.
  const stop = useCallback(() => {
    endsAt.current = null;
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(sync, TICK_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isRunning, sync]);

  return { isRunning, remainingSeconds, start, stop };
}
