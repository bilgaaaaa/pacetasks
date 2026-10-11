import { countdownEndsAt, formatClock, remainingSeconds } from "../countdown";

const START = Date.parse("2026-10-12T08:30:00Z");

describe("countdown", () => {
  it("ends the given number of seconds after it starts", () => {
    expect(countdownEndsAt(START, 25 * 60) - START).toBe(25 * 60 * 1000);
    expect(countdownEndsAt(START, -5)).toBe(START);
  });

  it("derives the time left from the clock, so a gap between ticks is not lost", () => {
    const endsAt = countdownEndsAt(START, 25 * 60);
    expect(remainingSeconds(endsAt, START)).toBe(25 * 60);
    expect(remainingSeconds(endsAt, START + 400)).toBe(25 * 60);
    expect(remainingSeconds(endsAt, START + 1000)).toBe(25 * 60 - 1);
    // The phone was locked for ten minutes: no ticks ran, the time still passed.
    expect(remainingSeconds(endsAt, START + 10 * 60 * 1000)).toBe(15 * 60);
  });

  it("stops at zero once the end has passed", () => {
    const endsAt = countdownEndsAt(START, 60);
    expect(remainingSeconds(endsAt, endsAt)).toBe(0);
    expect(remainingSeconds(endsAt, endsAt + 60 * 60 * 1000)).toBe(0);
  });

  it("formats seconds as a clock", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(90 * 60)).toBe("90:00");
  });
});
