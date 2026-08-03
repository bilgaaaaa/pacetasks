import { useCallback, useEffect, useState } from "react";
import { Task, TaskTiming } from "../lib/types";
import * as tasksApi from "../lib/tasksApi";

// Centralizes task state + Supabase calls so both the list screen and the
// stats screen read from the same loaded data without duplicating fetch logic.
export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await tasksApi.fetchTasks(userId);
      setTasks(data);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (title: string, estimatedMinutes: number, timing: TaskTiming) => {
      if (!userId) return;
      const newTask = await tasksApi.addTask(
        userId,
        title,
        estimatedMinutes,
        timing
      );
      setTasks((prev) => [newTask, ...prev]);
    },
    [userId]
  );

  const complete = useCallback(async (taskId: string, actualMinutes: number) => {
    const updated = await tasksApi.completeTask(taskId, actualMinutes);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  }, []);

  const remove = useCallback(async (taskId: string) => {
    await tasksApi.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  return { tasks, loading, error, refresh, create, complete, remove };
}
