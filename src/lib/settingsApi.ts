import { supabase } from "./supabase";
import { UserSettings } from "./types";

const DEFAULTS: Omit<UserSettings, "user_id" | "updated_at"> = {
  work_start_hour: 9,
  work_end_hour: 17,
  reminder_enabled: true,
  reminder_time: "18:30",
  timer_chime_enabled: true,
  haptics_enabled: false,
  pomodoro_work_minutes: 25,
  pomodoro_break_minutes: 5,
  brain_dump_auto_create: false,
};

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
    .insert({ user_id: userId, ...DEFAULTS })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
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
