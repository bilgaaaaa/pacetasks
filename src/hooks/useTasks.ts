import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Task, TaskDraft } from "../lib/types";
import * as tasksApi from "../lib/tasksApi";
import { supabase } from "../lib/supabase";
import { removeTask, upsertTask } from "@domain/taskCollection";

// Centralizes task state + Supabase calls so both the list screen and the
// stats screen read from the same loaded data without duplicating fetch logic.
// Stays in sync with changes made elsewhere (Siri, Brain Dump, other devices)
// through Realtime while open and a silent reload whenever the app returns.
export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `silent` skips the loading state so background reloads don't flash the spinner.
  const load = useCallback(
    async (silent: boolean) => {
      if (!userId) return;
      try {
        if (!silent) setLoading(true);
        const data = await tasksApi.fetchTasks(userId);
        setTasks(data);
        setError(null);
      } catch (e: any) {
        console.warn("[useTasks] load failed", e);
        setError(e.message ?? "Failed to load tasks");
      } finally {
        if (!silent) setLoading(false);
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
        if (deletedId) setTasks((prev) => removeTask(prev, deletedId));
      } else {
        setTasks((prev) => upsertTask(prev, payload.new));
      }
    };

    // Unique name per hook instance: Tasks and Stats screens each subscribe, and
    // supabase-js would otherwise hand both the same already-joined channel.
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
  }, [userId]);

  // Runs a mutation and reports a failure through `error` instead of throwing,
  // so a tap that fails (offline, database behind the app) is shown, not lost.
  const run = useCallback(async (label: string, action: () => Promise<void>): Promise<boolean> => {
    try {
      await action();
      setError(null);
      return true;
    } catch (e: any) {
      console.warn(`[useTasks] ${label} failed`, e);
      setError(e.message ?? `Couldn't ${label}`);
      return false;
    }
  }, []);

  const create = useCallback(
    (draft: TaskDraft) =>
      run("create task", async () => {
        const newTask = await tasksApi.createTask(draft);
        setTasks((prev) => upsertTask(prev, newTask));
      }),
    [run]
  );

  // Merges tasks created elsewhere (Brain Dump) without waiting for Realtime.
  const applyCreated = useCallback((created: Task[]) => {
    setTasks((prev) => created.reduce((list, task) => upsertTask(list, task), prev));
  }, []);

  const complete = useCallback(
    (taskId: string, actualMinutes: number | null) =>
      run("complete task", async () => {
        const updated = await tasksApi.completeTask(taskId, actualMinutes);
        setTasks((prev) => upsertTask(prev, updated));
      }),
    [run]
  );

  const remove = useCallback(
    (taskId: string) =>
      run("delete task", async () => {
        await tasksApi.deleteTask(taskId);
        setTasks((prev) => removeTask(prev, taskId));
      }),
    [run]
  );

  const clearCompleted = useCallback(
    () =>
      run("clear completed tasks", async () => {
        if (!userId) return;
        await tasksApi.clearCompletedTasks(userId);
        setTasks((prev) => prev.filter((t) => t.status !== "done"));
      }),
    [run, userId]
  );

  return { tasks, loading, error, refresh, create, applyCreated, complete, remove, clearCompleted };
}
