import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { isFocusBridgeAvailable, onFocusBridgeChange, sendFocusCommand } from "../lib/deskfocusBridge";
import {
  FocusPhase,
  focusPhaseAt,
  focusPlannedMinutes,
  focusSecondsLeft,
  isOngoingFor,
  SharedFocusSession,
} from "../lib/focusSession";
import { requestNotificationPermission } from "../lib/notifications";
import { focusTimeUpCopy } from "../lib/timerAlertCopy";
import { useCountdown } from "./useCountdown";
import { useTimerAlert } from "./useTimerAlert";

// Several checks per second keep the clock within a fraction of a second of the session's end.
const TICK_MS = 250;
// One local session at a time, so its end alert has a single key.
const FOCUS_ALERT_KEY = "focus";
// Replies that say nothing about the session, so the last known one stays on screen.
const TRANSPORT_ERRORS = new Set(["unavailable", "failed", "invalid_reply"]);

// What the Focus screen shows, the same whether the session lives natively or in this hook.
export interface FocusSessionView {
  sessionId: string;
  paceTaskId: string | null;
  taskTitle: string;
  phase: FocusPhase;
  remainingSeconds: number;
  plannedSeconds: number;
  plannedMinutes: number; // what a session run to its end records as actual minutes
}

interface Options {
  timerSoundEnabled: boolean;
  onTimeUp: (session: FocusSessionView) => void; // once per session, when it reaches its end while the app holds it
}

export interface FocusSessionControls {
  session: FocusSessionView | null;
  isStarting: boolean; // true from `start` until the session exists, so callers don't take the gap for an ended session
  start: (paceTaskId: string, taskTitle: string, minutes: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  end: () => void;
}

function toView(session: SharedFocusSession, nowMs: number): FocusSessionView {
  return {
    sessionId: session.sessionId,
    paceTaskId: session.paceTaskId,
    taskTitle: session.taskTitle,
    phase: focusPhaseAt(session, nowMs),
    remainingSeconds: focusSecondsLeft(session, nowMs),
    plannedSeconds: session.plannedSeconds,
    plannedMinutes: focusPlannedMinutes(session),
  };
}

// iOS: the session lives in the shared native state, so the widget, the Live Activity and the "time is up" alert
// follow it, and changes made there show up here. The app catches up with them whenever it comes to the front.
function useSharedFocusSession({ timerSoundEnabled, onTimeUp }: Options): FocusSessionControls {
  const [shared, setShared] = useState<SharedFocusSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timeUp = useRef(onTimeUp);
  timeUp.current = onTimeUp;
  const soundEnabled = useRef(timerSoundEnabled);
  soundEnabled.current = timerSoundEnabled;
  // Sessions seen running here, and the ones already reported as over, so each end is reported exactly once.
  const seenRunning = useRef(new Set<string>());
  const reported = useRef(new Set<string>());

  const send = useCallback(async (action: "state" | "pause" | "resume" | "end" | "reconcile") => {
    const reply = await sendFocusCommand({ action, timerSoundEnabled: soundEnabled.current });
    if (reply.error && TRANSPORT_ERRORS.has(reply.error)) return;
    setShared(reply.focus);
    setNowMs(Date.now());
  }, []);

  // Catch up on launch, whenever the app returns, and when the sound setting changes (it reschedules the alert).
  useEffect(() => {
    void send("reconcile");
  }, [send, timerSoundEnabled]);

  useEffect(() => {
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void send("reconcile");
    });
    const unsubscribe = onFocusBridgeChange(() => void send("state"));
    return () => {
      appState.remove();
      unsubscribe();
    };
  }, [send]);

  const phase = shared ? focusPhaseAt(shared, nowMs) : null;

  // Only a running session needs the clock to move.
  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!shared || !phase) return;
    if (phase === "running") seenRunning.current.add(shared.sessionId);
    if (phase !== "finished" || !seenRunning.current.has(shared.sessionId) || reported.current.has(shared.sessionId)) return;
    reported.current.add(shared.sessionId);
    console.log("[useFocusSession] focus time is up");
    timeUp.current(toView(shared, nowMs));
  }, [shared, phase, nowMs]);

  const start = useCallback(
    async (paceTaskId: string, _taskTitle: string, minutes: number) => {
      // Opening Focus on the task whose session is still going shows it, never restarts it.
      if (isOngoingFor(shared, paceTaskId, Date.now())) return;
      setIsStarting(true);
      try {
        // Asked first, so the "time is up" alert scheduled with the session can show.
        await requestNotificationPermission().catch((e) => console.warn("[useFocusSession] permission request failed", e));
        const reply = await sendFocusCommand({ action: "start", paceTaskId, minutes, timerSoundEnabled: soundEnabled.current });
        if (!reply.error || !TRANSPORT_ERRORS.has(reply.error)) setShared(reply.focus);
        setNowMs(Date.now());
      } finally {
        setIsStarting(false);
      }
    },
    [shared]
  );

  return {
    session: shared ? toView(shared, nowMs) : null,
    isStarting,
    start,
    pause: useCallback(() => void send("pause"), [send]),
    resume: useCallback(() => void send("resume"), [send]),
    end: useCallback(() => void send("end"), [send]),
  };
}

// Web demo, Android and builds without the native module: one session held here, with its own end alert.
function useLocalFocusSession({ onTimeUp }: Options): FocusSessionControls {
  const [local, setLocal] = useState<Omit<FocusSessionView, "phase" | "remainingSeconds"> | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const { schedule: scheduleAlert, cancel: cancelAlert } = useTimerAlert();
  const localRef = useRef(local);
  localRef.current = local;
  const timeUp = useRef(onTimeUp);
  timeUp.current = onTimeUp;

  const countdown = useCountdown(() => {
    const session = localRef.current;
    if (!session) return;
    setFinished(true);
    console.log("[useFocusSession] focus time is up");
    timeUp.current({ ...session, phase: "finished", remainingSeconds: 0 });
  });
  const { start: startCountdown, stop: stopCountdown } = countdown;

  const start = useCallback(
    async (paceTaskId: string, taskTitle: string, minutes: number) => {
      const current = localRef.current;
      if (current && current.paceTaskId === paceTaskId && !finished) return;
      const plannedSeconds = minutes * 60;
      setLocal({
        sessionId: `${paceTaskId}-${Date.now()}`,
        paceTaskId,
        taskTitle,
        plannedSeconds,
        plannedMinutes: Math.max(1, minutes),
      });
      setPausedSeconds(null);
      setFinished(false);
      startCountdown(plannedSeconds);
      scheduleAlert(FOCUS_ALERT_KEY, plannedSeconds, focusTimeUpCopy(taskTitle));
    },
    [finished, startCountdown, scheduleAlert]
  );

  const pause = useCallback(() => {
    if (!countdown.isRunning) return;
    setPausedSeconds(countdown.remainingSeconds);
    stopCountdown();
    cancelAlert(FOCUS_ALERT_KEY);
  }, [countdown.isRunning, countdown.remainingSeconds, stopCountdown, cancelAlert]);

  const resume = useCallback(() => {
    const session = localRef.current;
    if (!session || pausedSeconds === null) return;
    startCountdown(pausedSeconds);
    scheduleAlert(FOCUS_ALERT_KEY, pausedSeconds, focusTimeUpCopy(session.taskTitle));
    setPausedSeconds(null);
  }, [pausedSeconds, startCountdown, scheduleAlert]);

  const end = useCallback(() => {
    stopCountdown();
    cancelAlert(FOCUS_ALERT_KEY);
    setLocal(null);
    setPausedSeconds(null);
    setFinished(false);
  }, [stopCountdown, cancelAlert]);

  const session: FocusSessionView | null = local
    ? {
        ...local,
        phase: finished ? "finished" : pausedSeconds !== null ? "paused" : "running",
        remainingSeconds: finished
          ? 0
          : pausedSeconds ?? (countdown.isRunning ? countdown.remainingSeconds : local.plannedSeconds),
      }
    : null;

  return { session, isStarting: false, start, pause, resume, end };
}

// One Focus session for the whole app. Picked once per build, so the hooks inside never change order.
export const useFocusSession: (options: Options) => FocusSessionControls = isFocusBridgeAvailable()
  ? useSharedFocusSession
  : useLocalFocusSession;
