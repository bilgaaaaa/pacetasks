// Pure rules for the Focus session the app shares with the Deskfocus widget (see src/hooks/useFocusSession.ts).
// The native side owns the session; these functions read its replies and derive what the Focus screen shows.
import { remainingSeconds as secondsUntil } from "./countdown";

export type FocusPhase = "running" | "paused" | "finished";

// The session as the native handler reports it; field names match SharedFocusSession in
// targets/deskfocus/_shared/DeskfocusBridgeHandler.swift.
export interface SharedFocusSession {
  sessionId: string;
  paceTaskId: string | null; // null for a calendar event or reminder started in the widget
  taskTitle: string;
  phase: FocusPhase;
  endsAt: number | null; // ms since epoch, only while running
  remainingSeconds: number;
  plannedSeconds: number;
}

export interface FocusReply {
  focus: SharedFocusSession | null;
  error: string | null;
}

const PHASES: readonly FocusPhase[] = ["running", "paused", "finished"];

function isSession(value: unknown): value is SharedFocusSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.sessionId === "string" &&
    (session.paceTaskId === null || session.paceTaskId === undefined || typeof session.paceTaskId === "string") &&
    typeof session.taskTitle === "string" &&
    PHASES.includes(session.phase as FocusPhase) &&
    (session.endsAt === null || session.endsAt === undefined || typeof session.endsAt === "number") &&
    typeof session.remainingSeconds === "number" &&
    typeof session.plannedSeconds === "number"
  );
}

// Reads the handler's JSON; anything unreadable counts as "no session" with an error, so a bad reply never crashes Focus.
export function parseFocusReply(raw: string): FocusReply {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const error = typeof parsed.error === "string" ? parsed.error : null;
    if (parsed.focus === undefined || parsed.focus === null) return { focus: null, error };
    if (!isSession(parsed.focus)) return { focus: null, error: error ?? "invalid_reply" };
    const focus = parsed.focus;
    return {
      focus: { ...focus, paceTaskId: focus.paceTaskId ?? null, endsAt: focus.endsAt ?? null },
      error,
    };
  } catch {
    return { focus: null, error: "invalid_reply" };
  }
}

// The phase right now: a running session whose end has passed is already over, even before the native side records it.
export function focusPhaseAt(session: SharedFocusSession, nowMs: number): FocusPhase {
  if (session.phase !== "running") return session.phase;
  return session.endsAt !== null && session.endsAt > nowMs ? "running" : "finished";
}

// Whole seconds left, read from the clock while running so the screen matches the alert's moment.
export function focusSecondsLeft(session: SharedFocusSession, nowMs: number): number {
  switch (focusPhaseAt(session, nowMs)) {
    case "running":
      return secondsUntil(session.endsAt ?? nowMs, nowMs);
    case "paused":
      return Math.max(0, Math.ceil(session.remainingSeconds));
    case "finished":
      return 0;
  }
}

// Minutes the session was planned for, also after "+5 min": what a session run to its end records as actual minutes.
export function focusPlannedMinutes(session: SharedFocusSession): number {
  return Math.max(1, Math.round(session.plannedSeconds / 60));
}

// True when a session for this PaceTasks task is still going, so opening Focus on it again must not restart it.
export function isOngoingFor(session: SharedFocusSession | null, paceTaskId: string, nowMs: number): boolean {
  return !!session && session.paceTaskId === paceTaskId && focusPhaseAt(session, nowMs) !== "finished";
}
