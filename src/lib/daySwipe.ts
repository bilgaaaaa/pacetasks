// How a sideways swipe on Today's list turns into another day. Plain numbers and pure functions, so the feel
// can be tuned and tested without a phone; `useDaySwipe` only animates what these decide.
export const DAY_SWIPE = {
  // Sideways points before a touch counts as a swipe; less stays a tap or the start of a scroll.
  startDistance: 12,
  // How much more sideways than up or down the movement must be, so a scroll never turns the day.
  directionRatio: 1.5,
  // Share of the screen width a slow swipe has to cover to change the day.
  distanceRatio: 0.25,
  // A flick at least this fast (points per ms) changes the day even when it is short.
  flickVelocity: 0.5,
  // Shortest flick that counts, so a quick twitch of the finger doesn't.
  flickDistance: 24,
  // How faded the list is when pulled a whole screen width away.
  edgeOpacity: 0.2,
  // The old day sliding out, then the new one sliding in from this share of the width.
  exitMs: 160,
  enterMs: 220,
  enterRatio: 0.3,
} as const;

// One day later (+1) or earlier (-1).
export type DaySwipeStep = -1 | 1;

// Whether a moving touch is a sideways swipe rather than a vertical scroll or a tap.
export function isDaySwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > DAY_SWIPE.startDistance && Math.abs(dx) > Math.abs(dy) * DAY_SWIPE.directionRatio;
}

// The day a finished swipe moves to: the next day when the finger went left (like turning a page), the previous
// day when it went right, or none (0) when it was too short and slow, or flung back the other way.
export function swipeDayStep(dx: number, vx: number, width: number): DaySwipeStep | 0 {
  const flung = Math.abs(vx) >= DAY_SWIPE.flickVelocity;
  if (flung && Math.sign(vx) !== Math.sign(dx)) return 0;
  const farEnough = Math.abs(dx) >= width * DAY_SWIPE.distanceRatio;
  const flicked = flung && Math.abs(dx) >= DAY_SWIPE.flickDistance;
  if (!farEnough && !flicked) return 0;
  return dx < 0 ? 1 : -1;
}
