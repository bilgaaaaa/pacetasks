import { DAY_SWIPE, isDaySwipe, swipeDayStep } from "../daySwipe";

const WIDTH = 400;

describe("isDaySwipe", () => {
  it("takes a clearly sideways movement in either direction", () => {
    expect(isDaySwipe(30, 4)).toBe(true);
    expect(isDaySwipe(-30, -4)).toBe(true);
  });

  it("leaves taps and the start of any movement alone", () => {
    expect(isDaySwipe(DAY_SWIPE.startDistance, 0)).toBe(false);
    expect(isDaySwipe(3, 1)).toBe(false);
  });

  it("leaves vertical and diagonal movements to the list's scrolling", () => {
    expect(isDaySwipe(4, 40)).toBe(false);
    expect(isDaySwipe(30, 25)).toBe(false);
  });
});

describe("swipeDayStep", () => {
  it("turns to the next day when the finger goes left far enough", () => {
    expect(swipeDayStep(-WIDTH * DAY_SWIPE.distanceRatio, 0, WIDTH)).toBe(1);
  });

  it("turns to the previous day when the finger goes right far enough", () => {
    expect(swipeDayStep(WIDTH * 0.5, 0.1, WIDTH)).toBe(-1);
  });

  it("springs back after a short, slow swipe", () => {
    expect(swipeDayStep(-60, -0.1, WIDTH)).toBe(0);
    expect(swipeDayStep(60, 0.2, WIDTH)).toBe(0);
  });

  it("turns on a short but fast flick", () => {
    expect(swipeDayStep(-40, -0.8, WIDTH)).toBe(1);
    expect(swipeDayStep(40, 0.8, WIDTH)).toBe(-1);
  });

  it("ignores a fast twitch that barely moved", () => {
    expect(swipeDayStep(-10, -1.2, WIDTH)).toBe(0);
  });

  it("stays on the day when a long swipe is flung back the other way", () => {
    expect(swipeDayStep(-WIDTH * 0.6, 0.9, WIDTH)).toBe(0);
    expect(swipeDayStep(WIDTH * 0.6, -0.9, WIDTH)).toBe(0);
  });
});
