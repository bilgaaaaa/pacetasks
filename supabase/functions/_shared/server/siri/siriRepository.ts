import { createClient } from "@supabase/supabase-js";
import type { Task } from "../../domain/task.ts";

export interface SiriUserContext {
  workStartHour: number;
  workEndHour: number;
  tasks: Task[]; // pending tasks only: Siri never talks about done or parked ones
}

// Data access Siri's answers need, always as the signed-in user (RLS applies).
export interface SiriRepository {
  getUserId(): Promise<string | null>;
  isPro(): Promise<boolean>;
  loadUserContext(): Promise<SiriUserContext>;
}

const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 17;
const PENDING_TASK_LIMIT = 500; // far beyond a real Today list; keeps a runaway account cheap

export function createSupabaseSiriRepository(options: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authorizationHeader: string;
}): SiriRepository {
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

    async isPro() {
      const { data, error } = await supabase.rpc("is_pro");
      if (error) throw error;
      return data === true;
    },

    async loadUserContext() {
      const [settingsResult, tasksResult] = await Promise.all([
        supabase.from("user_settings").select("work_start_hour, work_end_hour").maybeSingle(),
        supabase
          .from("tasks")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false }) // same order as the app, so Today reads the same
          .limit(PENDING_TASK_LIMIT),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (tasksResult.error) throw tasksResult.error;
      return {
        workStartHour: settingsResult.data?.work_start_hour ?? DEFAULT_WORK_START_HOUR,
        workEndHour: settingsResult.data?.work_end_hour ?? DEFAULT_WORK_END_HOUR,
        tasks: (tasksResult.data ?? []) as Task[],
      };
    },
  };
}
