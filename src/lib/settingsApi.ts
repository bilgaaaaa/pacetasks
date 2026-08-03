import { supabase } from "./supabase";
import { UserSettings } from "./types";

const DEFAULTS: Omit<UserSettings, "user_id" | "updated_at"> = {
  work_start_hour: 9,
  work_end_hour: 17,
  reminder_enabled: true,
  reminder_time: "18:30",
};

// Returns the user's settings row, creating a default one on first launch.
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
