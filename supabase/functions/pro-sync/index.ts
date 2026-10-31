import { usesRulesProvider } from "../_shared/server/ai/providerFactory.ts";
import { createSupabaseAuthenticator, requireEnv } from "../_shared/server/http/supabaseAuth.ts";
import { createProSyncDeps } from "../_shared/server/pro/proDeps.ts";
import { handleProSyncHttp } from "../_shared/server/pro/proHttp.ts";

// POST /functions/v1/pro-sync — refreshes the caller's PaceTasks Pro state from
// RevenueCat and returns it. Secrets: REVENUECAT_SECRET_API_KEY (optional).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected.

const deps = createProSyncDeps("pro-sync");
const authenticate = createSupabaseAuthenticator({
  supabaseUrl: requireEnv("pro-sync", "SUPABASE_URL"),
  supabaseAnonKey: requireEnv("pro-sync", "SUPABASE_ANON_KEY"),
});

Deno.serve((request) =>
  handleProSyncHttp(request, {
    ...deps,
    authenticate,
    // Read per request, like brain-dump, so switching AI_PROVIDER needs no redeploy.
    aiBrainDump: () => !usesRulesProvider((name) => Deno.env.get(name)),
    now: () => new Date(),
  })
);
