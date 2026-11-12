import {
  focusPhaseAt,
  focusPlannedMinutes,
  focusSecondsLeft,
  isOngoingFor,
  parseFocusReply,
  SharedFocusSession,
} from "../focusSession";

const NOW = Date.parse("2026-11-08T14:00:00Z");

const running: SharedFocusSession = {
  sessionId: "s1",
  paceTaskId: "task-1",
  taskTitle: "Write the report",
  phase: "running",
  endsAt: NOW + 25 * 60 * 1000,
  remainingSeconds: 25 * 60,
  plannedSeconds: 25 * 60,
};

describe("parseFocusReply", () => {
  it("reads a session the native handler reported", () => {
    expect(parseFocusReply(JSON.stringify({ focus: running }))).toEqual({ focus: running, error: null });
  });

  it("treats a missing focus key as no session", () => {
    expect(parseFocusReply("{}")).toEqual({ focus: null, error: null });
  });

  it("fills in the optional fields Swift leaves out when they are nil", () => {
    const { paceTaskId, endsAt, ...rest } = running;
    const reply = parseFocusReply(JSON.stringify({ focus: { ...rest, phase: "paused" } }));
    expect(reply.focus).toEqual({ ...rest, phase: "paused", paceTaskId: null, endsAt: null });
  });

  it("keeps the handler's error next to the current session", () => {
    expect(parseFocusReply(JSON.stringify({ focus: running, error: "unknown_task" }))).toEqual({
      focus: running,
      error: "unknown_task",
    });
  });

  it("reports an unreadable reply instead of throwing", () => {
    expect(parseFocusReply("not json")).toEqual({ focus: null, error: "invalid_reply" });
    expect(parseFocusReply(JSON.stringify({ focus: { sessionId: 3 } }))).toEqual({ focus: null, error: "invalid_reply" });
  });
});

describe("focus phase and time left", () => {
  it("counts a running session down against its end", () => {
    expect(focusPhaseAt(running, NOW)).toBe("running");
    expect(focusSecondsLeft(running, NOW)).toBe(25 * 60);
    // The phone was locked for ten minutes; the clock still moved.
    expect(focusSecondsLeft(running, NOW + 10 * 60 * 1000)).toBe(15 * 60);
  });

  it("is over once the end has passed, even before the native side records it", () => {
    expect(focusPhaseAt(running, running.endsAt!)).toBe("finished");
    expect(focusSecondsLeft(running, running.endsAt! + 1000)).toBe(0);
  });

  it("holds the time left while paused", () => {
    const paused: SharedFocusSession = { ...running, phase: "paused", endsAt: null, remainingSeconds: 600.4 };
    expect(focusPhaseAt(paused, NOW + 60 * 60 * 1000)).toBe("paused");
    expect(focusSecondsLeft(paused, NOW + 60 * 60 * 1000)).toBe(601);
  });

  it("records the planned length, including added minutes", () => {
    expect(focusPlannedMinutes(running)).toBe(25);
    expect(focusPlannedMinutes({ ...running, plannedSeconds: 30 * 60 })).toBe(30);
    expect(focusPlannedMinutes({ ...running, plannedSeconds: 10 })).toBe(1);
  });
});

describe("isOngoingFor", () => {
  it("is true only for the same task while the session still runs or is paused", () => {
    expect(isOngoingFor(running, "task-1", NOW)).toBe(true);
    expect(isOngoingFor({ ...running, phase: "paused", endsAt: null }, "task-1", NOW)).toBe(true);
    expect(isOngoingFor(running, "task-2", NOW)).toBe(false);
    expect(isOngoingFor(running, "task-1", running.endsAt!)).toBe(false);
    expect(isOngoingFor(null, "task-1", NOW)).toBe(false);
  });
});
