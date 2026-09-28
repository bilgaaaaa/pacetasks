import { createClient } from "@supabase/supabase-js";
import type { Task } from "../../domain/task.ts";
import type { BrainDumpRepository } from "./brainDumpRepository.ts";

// Most recent tasks loaded for history and duplicate checks; enough for
// realistic personal use without loading years of data per request.
const CONTEXT_TASK_LIMIT = 1000;

const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 17;

// Supabase-backed repository using the caller's own JWT, so every query runs
// under row-level security exactly like the app's own requests.
export function createSupabaseBrainDumpRepository(options: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authorizationHeader: string;
}): BrainDumpRepository {
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

    async incrementUsage(feature) {
      const { data, error } = await supabase.rpc("increment_ai_usage", { feature });
      if (error) throw error;
      return data as number;
    },

    async loadUserContext() {
      const [settingsResult, tasksResult] = await Promise.all([
        supabase
          .from("user_settings")
          .select("work_start_hour, work_end_hour, brain_dump_auto_create")
          .maybeSingle(),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(CONTEXT_TASK_LIMIT),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (tasksResult.error) throw tasksResult.error;

      const settings = settingsResult.data;
      return {
        workStartHour: settings?.work_start_hour ?? DEFAULT_WORK_START_HOUR,
        workEndHour: settings?.work_end_hour ?? DEFAULT_WORK_END_HOUR,
        autoCreateEnabled: settings?.brain_dump_auto_create ?? false,
        tasks: (tasksResult.data ?? []) as Task[],
      };
    },

    async createSession(session) {
      const { data, error } = await supabase
        .from("brain_dump_sessions")
        .insert({
          channel: session.channel,
          raw_text: session.rawText,
          time_zone: session.timeZone,
          proposal: session.proposal,
          ai_provider: session.aiProvider,
          ai_model: session.aiModel,
          prompt_version: session.promptVersion,
          input_tokens: session.usage.inputTokens,
          output_tokens: session.usage.outputTokens,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    async commitSession(sessionId, drafts) {
      const { data, error } = await supabase.rpc("commit_brain_dump", { session_id: sessionId, drafts });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  };
}
