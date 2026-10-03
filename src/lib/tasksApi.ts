import { supabase } from "./supabase";
import { Task, TaskDraft, TaskPatch } from "./types";

// Newest-first, which taskHistory and upsertTask both rely on.
export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Creates a task through public.create_task, the single creation path shared
// with Brain Dump and Siri; the owner comes from the session, not the draft.
export async function createTask(draft: TaskDraft): Promise<Task> {
  const { data, error } = await supabase.rpc("create_task", { draft });

  if (error) throw error;
  return data as Task;
}

// `actualMinutes` is null when the real time is unknown (e.g. completed via
// Siri), so the estimate-accuracy stat isn't skewed by a guess.
export async function completeTask(
  taskId: string,
  actualMinutes: number | null
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

// Moves or parks a task. Patches come from @domain/taskPatch, so the same few
// fields change the same way everywhere; postponed_count is kept by the database.
export async function updateTask(taskId: string, patch: TaskPatch): Promise<Task> {
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", taskId).select().single();

  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function clearCompletedTasks(userId: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("status", "done");
  if (error) throw error;
}
