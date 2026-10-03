import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

// Loaded only in demo mode, so a real build never runs the demo backend or the
// rule-based parser it pulls in (whose patterns need a modern RegExp engine).
function createDemoSupabaseClient(): SupabaseClient {
  const { createDemoClient } = require("./demo/demoBackend") as typeof import("./demo/demoBackend");
  return createDemoClient() as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isDemoMode
  ? createDemoSupabaseClient()
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

// Confirming the email through the emailed link (instead of typing the code)
// changes the user on the server only. Refreshing a still-anonymous session
// brings that into the app; onAuthStateChange then delivers the updated user.
export async function refreshAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user.is_anonymous) return;
  const { error } = await supabase.auth.refreshSession();
  if (error) console.warn("[supabase] session refresh failed", error.message);
}
