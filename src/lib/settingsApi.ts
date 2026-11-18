import { supabase } from "./supabase";
import { UserSettings } from "./types";

// What a new user starts with; also the fallback screens use while settings are still loading.
export const DEFAULT_SETTINGS: Omit<UserSettings, "user_id" | "updated_at"> = {
  work_start_hour: 9,
  work_end_hour: 17,
  reminder_enabled: true,
  reminder_time: "18:30",
  task_reminder_enabled: true,
  timer_chime_enabled: true,
  haptics_enabled: false,
  pomodoro_work_minutes: 25,
  pomodoro_break_minutes: 5,
  brain_dump_auto_create: false,
};

const UNIQUE_VIOLATION = "23505"; // Postgres: the row already exists

export async function fetchOrCreateSettings(
  userId: string
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("user_settings")
    .insert({ user_id: userId, ...DEFAULT_SETTINGS })
    .select()
    .single();

  if (!insertError) return created;
  // Another caller (a second phone, a retry) created the row first: read theirs.
  if (insertError.code !== UNIQUE_VIOLATION) throw insertError;
  console.log("[settingsApi] settings row already existed, reading it");
  const { data: existing, error: rereadError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (rereadError) throw rereadError;
  return existing;
}

export async function updateSettings(
  userId: string,
  patch: Partial<Omit<UserSettings, "user_id" | "updated_at">>
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
