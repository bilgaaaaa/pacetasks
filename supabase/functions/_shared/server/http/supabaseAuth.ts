import { createClient } from "@supabase/supabase-js";

// Resolves the caller's user id from their "Bearer <jwt>" header; null when the token is invalid or expired.
export function createSupabaseAuthenticator(options: { supabaseUrl: string; supabaseAnonKey: string }) {
  const supabase = createClient(options.supabaseUrl, options.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (authorizationHeader: string): Promise<string | null> => {
    const accessToken = authorizationHeader.replace(/^Bearer\s+/i, "");
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user.id;
  };
}

// Reads a required secret or stops the function at boot with a clear log line.
export function requireEnv(functionName: string, name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[${functionName}] missing required env ${name}`);
  return value;
}
