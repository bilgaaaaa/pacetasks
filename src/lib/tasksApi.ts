import { supabase } from "./supabase";
import { Task, TaskTiming } from "./types";

// Thin wrapper around every tasks-table query so screens never write raw
// Supabase calls directly — one place to fix if the schema changes.

export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addTask(
  userId: string,
  title: string,
  estimatedMinutes: number,
  timing: TaskTiming
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: title.trim(),
      estimated_minutes: estimatedMinutes,
      timing,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeTask(
  taskId: string,
  actualMinutes: number
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "done",
      actual_minutes: actualMinutes,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}
