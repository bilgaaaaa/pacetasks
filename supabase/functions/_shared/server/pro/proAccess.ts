import { createClient } from "@supabase/supabase-js";

// SIRI_REQUIRES_PRO=1 turns on the server's Pro check for Siri. Off by default, so
// builds that unlock Pro without a purchase (TestFlight, no store) keep Siri until launch.
export function siriRequiresPro(env: (name: string) => string | undefined): boolean {
  return env("SIRI_REQUIRES_PRO") === "1";
}

// Asks the database, as the signed-in user, whether they have an active Pro subscription (is_pro()).
export function createProAccessCheck(options: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authorizationHeader: string;
}): () => Promise<boolean> {
  const supabase = createClient(options.supabaseUrl, options.supabaseAnonKey, {
    global: { headers: { Authorization: options.authorizationHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async () => {
    const { data, error } = await supabase.rpc("is_pro");
    if (error) throw error;
    return data === true;
  };
}
