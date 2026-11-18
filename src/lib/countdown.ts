// Pure math for countdown timers. A countdown is stored as the moment it ends,
// never as a number decremented per tick: iOS suspends JS timers while the phone
// is locked, so only the clock can say how much time is really left.

const MS_PER_SECOND = 1000;

// The clock time (ms since epoch) at which a countdown started now will end.
export function countdownEndsAt(nowMs: number, durationSeconds: number): number {
  return nowMs + Math.max(0, durationSeconds) * MS_PER_SECOND;
}

// Whole seconds left until `endsAtMs`, rounded up so a countdown shows its full
// length on the first tick and reaches 0 only once the time has truly passed.
export function remainingSeconds(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / MS_PER_SECOND));
}

// "MM:SS" for a countdown display; minutes keep counting past 59 ("90:00").
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
