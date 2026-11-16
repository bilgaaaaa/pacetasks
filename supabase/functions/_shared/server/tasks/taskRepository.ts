import { createClient } from "@supabase/supabase-js";
import { PACE_POLICY } from "../../domain/pace.ts";
import type { Task } from "../../domain/task.ts";
import type { TaskPatch } from "../../domain/taskPatch.ts";

export interface UserTaskContext {
  workStartHour: number;
  workEndHour: number;
  // Pending tasks plus the latest timed ones, so answers count the learned pace.
  // Done and parked tasks are never listed or moved: every domain rule filters on status.
  tasks: Task[];
}

// Data access Siri and Rescue my day need, always as the signed-in user (RLS applies).
export interface TaskRepository {
  getUserId(): Promise<string | null>;
  loadUserContext(): Promise<UserTaskContext>;
  updateTask(taskId: string, patch: TaskPatch): Promise<void>;
}

const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 17;
const PENDING_TASK_LIMIT = 500; // far beyond a real Today list; keeps a runaway account cheap

export function createSupabaseTaskRepository(options: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authorizationHeader: string;
}): TaskRepository {
  const supabase = createClient(options.supabaseUrl, options.supabaseAnonKey, {
    global: { headers: { Authorization: options.authorizationHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const accessToken = options.authorizationHeader.replace(/^Bearer\s+/i, "");

  return {
    async getUserId() {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data.user) return null;
      return data.user.id;
    },

    async loadUserContext() {
      const [settingsResult, pendingResult, timedResult] = await Promise.all([
        supabase.from("user_settings").select("work_start_hour, work_end_hour").maybeSingle(),
        supabase
          .from("tasks")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false }) // same order as the app, so Today reads the same
          .limit(PENDING_TASK_LIMIT),
        supabase
          .from("tasks")
          .select("*")
          .eq("status", "done")
          .gt("actual_minutes", 0)
          .order("created_at", { ascending: false })
          .limit(PACE_POLICY.historyLimit),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (pendingResult.error) throw pendingResult.error;
      if (timedResult.error) throw timedResult.error;
      return {
        workStartHour: settingsResult.data?.work_start_hour ?? DEFAULT_WORK_START_HOUR,
        workEndHour: settingsResult.data?.work_end_hour ?? DEFAULT_WORK_END_HOUR,
        tasks: [...(pendingResult.data ?? []), ...(timedResult.data ?? [])] as Task[],
      };
    },

    async updateTask(taskId, patch) {
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
      if (error) throw error;
    },
  };
}
