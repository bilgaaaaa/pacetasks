import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Task, TaskChange, TaskDraft, TaskPatch } from "../lib/types";
import * as tasksApi from "../lib/tasksApi";
import { supabase } from "../lib/supabase";
import { removeTask, upsertTask } from "@domain/taskCollection";

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (draft: TaskDraft) => Promise<Task | undefined>;
  applyCreated: (created: Task[]) => void;
  complete: (taskId: string, actualMinutes: number | null) => Promise<boolean>;
  update: (taskId: string, patch: TaskPatch) => Promise<boolean>;
  updateMany: (changes: TaskChange[]) => Promise<boolean>;
  remove: (taskId: string) => Promise<boolean>;
}

// The loaded list together with the user it belongs to, so a list can never be shown to another user.
interface LoadedTasks {
  userId: string | undefined;
  tasks: Task[];
}

const NO_TASKS: Task[] = [];

const TasksContext = createContext<TasksContextValue | null>(null);

// Loads the current user's tasks once for the whole app, so every screen reads
// the same copy through one fetch and one Realtime channel. Stays in sync with
// changes made elsewhere (Siri, Brain Dump, other devices) through Realtime while
// open and a silent reload whenever the app returns. The list is dropped the
// moment the user changes, so nothing of the previous user stays.
export function TasksProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const [loaded, setLoaded] = useState<LoadedTasks>({ userId, tasks: NO_TASKS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The user the app is on right now: an answer that arrives for an earlier user is ignored.
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  // Changes this user's list; a change that belongs to an earlier user is dropped.
  const changeTasks = useCallback(
    (change: (tasks: Task[]) => Task[]) => {
      setLoaded((current) => (current.userId === userId ? { userId, tasks: change(current.tasks) } : current));
    },
    [userId]
  );

  // `silent` skips the loading state so background reloads don't flash the spinner.
  const load = useCallback(
    async (silent: boolean) => {
      setLoaded((current) => (current.userId === userId ? current : { userId, tasks: NO_TASKS }));
      if (!userId) {
        setError(null); // no user (between sign-out and the next session): nothing of the previous one may stay on screen
        return;
      }
      try {
        if (!silent) setLoading(true);
        const data = await tasksApi.fetchTasks(userId);
        if (currentUserId.current !== userId) return;
        setLoaded({ userId, tasks: data });
        setError(null);
      } catch (e: any) {
        if (currentUserId.current !== userId) return;
        console.warn("[useTasks] load failed", e);
        setError(e.message ?? "Failed to load tasks");
      } finally {
        if (!silent && currentUserId.current === userId) setLoading(false);
      }
    },
    [userId]
  );

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reload when the app comes back to the foreground: Realtime doesn't deliver
  // changes made while the app was suspended.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load(true);
    });
    return () => subscription.remove();
  }, [load]);

  // Live changes while the app is open. Deletes can't be filtered by user_id
  // (their payload only carries the id), so they use a separate unfiltered listener.
  useEffect(() => {
    if (!userId) return;

    const applyChange = (payload: RealtimePostgresChangesPayload<Task>) => {
      if (payload.eventType === "DELETE") {
        const deletedId = payload.old.id;
        if (deletedId) changeTasks((prev) => removeTask(prev, deletedId));
      } else {
        changeTasks((prev) => upsertTask(prev, payload.new));
      }
    };

    // Unique name per subscription: removing a channel is not instant, and supabase-js
    // would hand a quick re-subscribe (user switched back) the channel that is still leaving.
    const channelName = `tasks-${userId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on<Task>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        applyChange
      )
      .on<Task>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        applyChange
      )
      .on<Task>("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, applyChange)
      .subscribe((status, err) => {
        if (err) console.warn("[useTasks] realtime subscription error", status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, changeTasks]);

  // Runs a mutation and reports a failure through `error` instead of throwing,
  // so a tap that fails (offline, database behind the app) is shown, not lost.
  const run = useCallback(
    async (label: string, action: () => Promise<void>): Promise<boolean> => {
      try {
        await action();
        if (currentUserId.current === userId) setError(null);
        return true;
      } catch (e: any) {
        console.warn(`[useTasks] ${label} failed`, e);
        if (currentUserId.current === userId) setError(e.message ?? `Couldn't ${label}`);
        return false;
      }
    },
    [userId]
  );

  // Returns the created task (so the add sheet can offer Undo), or undefined when saving failed.
  const create = useCallback(
    async (draft: TaskDraft): Promise<Task | undefined> => {
      let created: Task | undefined;
      await run("create task", async () => {
        const newTask = await tasksApi.createTask(draft);
        changeTasks((prev) => upsertTask(prev, newTask));
        created = newTask;
      });
      return created;
    },
    [run, changeTasks]
  );

  // Merges tasks created elsewhere (Brain Dump) without waiting for Realtime.
  const applyCreated = useCallback(
    (created: Task[]) => {
      changeTasks((prev) => created.reduce((list, task) => upsertTask(list, task), prev));
    },
    [changeTasks]
  );

  const complete = useCallback(
    (taskId: string, actualMinutes: number | null) =>
      run("complete task", async () => {
        const updated = await tasksApi.completeTask(taskId, actualMinutes);
        changeTasks((prev) => upsertTask(prev, updated));
      }),
    [run, changeTasks]
  );

  // Moves or parks one task (see @domain/taskPatch for the patches).
  const update = useCallback(
    (taskId: string, patch: TaskPatch) =>
      run("update task", async () => {
        const updated = await tasksApi.updateTask(taskId, patch);
        changeTasks((prev) => upsertTask(prev, updated));
      }),
    [run, changeTasks]
  );

  // Applies several changes in order (rollover, Weekly Reset). Stops at the first
  // failure; the ones already applied stay applied and show in the list.
  const updateMany = useCallback(
    (changes: TaskChange[]) =>
      run("update tasks", async () => {
        for (const { taskId, patch } of changes) {
          const updated = await tasksApi.updateTask(taskId, patch);
          changeTasks((prev) => upsertTask(prev, updated));
        }
      }),
    [run, changeTasks]
  );

  const remove = useCallback(
    (taskId: string) =>
      run("delete task", async () => {
        await tasksApi.deleteTask(taskId);
        changeTasks((prev) => removeTask(prev, taskId));
      }),
    [run, changeTasks]
  );

  const tasks = loaded.userId === userId ? loaded.tasks : NO_TASKS;
  const value = useMemo(
    () => ({ tasks, loading, error, refresh, create, applyCreated, complete, update, updateMany, remove }),
    [tasks, loading, error, refresh, create, applyCreated, complete, update, updateMany, remove]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

// The current user's tasks and the ways to change them, shared by every screen (see TasksProvider).
export function useTasks(): TasksContextValue {
  const context = useContext(TasksContext);
  if (!context) throw new Error("useTasks must be used inside TasksProvider");
  return context;
}
