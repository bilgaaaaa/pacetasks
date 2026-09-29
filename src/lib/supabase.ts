import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createDemoClient } from "./demo/demoBackend";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Demo mode swaps in an in-memory backend so the app can be previewed (e.g. the
// web simulator) without Supabase keys. Never set this for a real build.
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

if (!isDemoMode && (!supabaseUrl || !supabaseAnonKey)) {
  // Fails loudly at startup instead of silently breaking every request later.
  console.warn(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your project URL/key."
  );
}

export const supabase: SupabaseClient = isDemoMode
  ? (createDemoClient() as unknown as SupabaseClient)
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

// Ensures every device has a stable anonymous user so tasks can be scoped
// with row-level security without asking the user to sign up.
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signInData.session;
}
