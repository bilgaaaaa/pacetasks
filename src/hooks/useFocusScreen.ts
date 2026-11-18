import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Task } from "../lib/types";
import { FocusSessionView, useFocusSession } from "./useFocusSession";
import { useHaptics } from "./useHaptics";

interface Options {
  tasks: Task[];
  tasksReady: boolean; // false while tasks load or failed to load, so a missing task is not taken for a deleted one
  workMinutes: number; // the Focus timer length a session started in the app runs for
  timerSoundEnabled: boolean | undefined; // undefined while settings load
  otherSheetOpen: boolean; // iOS shows one sheet at a time, so Focus never opens on its own over another one
  completeTask: (taskId: string, actualMinutes: number, silent?: boolean) => Promise<boolean>;
}

// Which task the Focus screen shows, kept in step with the one Focus session the app shares with the DeskFocus widget.
// A session the app started is a Focus timer: run to its end on screen, it completes the task with its planned minutes.
// A session started in the widget opens the screen once, and its end is left to the widget and its alert.
export function useFocusScreen({ tasks, tasksReady, workMinutes, timerSoundEnabled, otherSheetOpen, completeTask }: Options) {
  const haptics = useHaptics();
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const focusTaskIdRef = useRef(focusTaskId);
  focusTaskIdRef.current = focusTaskId;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  // Sessions started from the Focus pill: only these complete their task on their own.
  const appStartedSessionIds = useRef(new Set<string>());
  // Sessions the auto-open has decided on, so each opens the screen at most once.
  const handledSessionIds = useRef(new Set<string>());
  // The task whose start is on its way, so its session is not mistaken for one started in the widget.
  const startingTaskId = useRef<string | null>(null);

  const isPending = (taskId: string) => tasksRef.current.some((task) => task.id === taskId && task.status === "pending");

  const focus = useFocusSession({
    timerSoundEnabled,
    onTimeUp: (session: FocusSessionView) => {
      const taskId = session.paceTaskId;
      if (!taskId || taskId !== focusTaskIdRef.current) return;
      haptics.play("timerEnded");
      if (appStartedSessionIds.current.has(session.sessionId) && isPending(taskId)) {
        console.log("[useFocusScreen] Focus timer ran to its end, completing the task");
        void completeTask(taskId, session.plannedMinutes, true);
        focus.end();
      }
      setFocusTaskId(null);
    },
  });
  const { session, isStarting, start, end } = focus;

  const open = useCallback(
    (task: Task) => {
      const wasOngoing = !!session && session.paceTaskId === task.id && session.phase !== "finished";
      startingTaskId.current = task.id;
      setFocusTaskId(task.id);
      void start(task.id, task.title, workMinutes).then((started) => {
        startingTaskId.current = null;
        if (!started) {
          console.warn("[useFocusScreen] focus did not start");
          return;
        }
        handledSessionIds.current.add(started.sessionId);
        if (!wasOngoing) appStartedSessionIds.current.add(started.sessionId);
        // Closed while the start was on its way: the session must not run unseen.
        if (started.paceTaskId === task.id && focusTaskIdRef.current !== task.id) end();
      });
    },
    [session, start, end, workMinutes]
  );

  // Closing ends a session still going; a finished one from the widget keeps its "time is up" choices there.
  const close = useCallback(() => {
    if (session && session.paceTaskId === focusTaskIdRef.current && session.phase !== "finished") end();
    setFocusTaskId(null);
  }, [session, end]);

  const doneEarly = useCallback(
    (taskId: string, actualMinutes: number) => {
      void completeTask(taskId, actualMinutes);
      if (session?.paceTaskId === taskId) end();
      setFocusTaskId(null);
    },
    [session, end, completeTask]
  );

  // A session started in the widget or the Live Activity opens the screen on its task, once, when nothing else is showing.
  // Otherwise it keeps running in the Live Activity, and its row's Focus pill shows it.
  useEffect(() => {
    if (!session?.paceTaskId || session.phase === "finished") return;
    if (handledSessionIds.current.has(session.sessionId) || session.paceTaskId === startingTaskId.current) return;
    if (focusTaskId === session.paceTaskId) {
      handledSessionIds.current.add(session.sessionId);
      return;
    }
    if (!isPending(session.paceTaskId)) return; // tasks may still be loading; decided once they are there
    handledSessionIds.current.add(session.sessionId);
    if (focusTaskId || otherSheetOpen) return;
    console.log("[useFocusScreen] showing a focus session started in the widget");
    setFocusTaskId(session.paceTaskId);
  }, [session?.sessionId, session?.paceTaskId, session?.phase, focusTaskId, otherSheetOpen, tasks]);

  // The session ended or moved to another task elsewhere (widget ✓ or ■, another ▶): the screen follows.
  useEffect(() => {
    if (!focusTaskId || isStarting || session?.paceTaskId === focusTaskId) return;
    console.log("[useFocusScreen] focus session ended elsewhere, closing the Focus screen");
    setFocusTaskId(null);
  }, [focusTaskId, isStarting, session?.paceTaskId]);

  // The task was deleted, completed or parked elsewhere: nothing is left to focus on.
  useEffect(() => {
    if (!focusTaskId || !tasksReady || isPending(focusTaskId)) return;
    console.log("[useFocusScreen] focus task is no longer open, ending its session");
    if (session?.paceTaskId === focusTaskId && session.phase !== "finished") end();
    setFocusTaskId(null);
  }, [focusTaskId, tasksReady, tasks, session?.paceTaskId, session?.phase, end]);

  const task = useMemo(
    () => (focusTaskId ? tasks.find((candidate) => candidate.id === focusTaskId) ?? null : null),
    [tasks, focusTaskId]
  );

  return {
    task,
    session: session && session.paceTaskId === focusTaskId ? session : null,
    open,
    close,
    doneEarly,
    pause: focus.pause,
    resume: focus.resume,
  };
}
