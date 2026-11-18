import { requireEnv } from "../http/supabaseAuth.ts";
import { createSupabaseProEntitlementStore } from "./proEntitlementStore.ts";
import type { ProSyncDeps } from "./proSync.ts";
import { createRevenueCatClient } from "./revenueCatClient.ts";

// Real Pro dependencies for an Edge Function. REVENUECAT_SECRET_API_KEY is
// optional: without it the stored entitlement is used as-is.
export function createProSyncDeps(functionName: string): ProSyncDeps {
  const secretApiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  return {
    store: createSupabaseProEntitlementStore({
      supabaseUrl: requireEnv(functionName, "SUPABASE_URL"),
      serviceRoleKey: requireEnv(functionName, "SUPABASE_SERVICE_ROLE_KEY"),
    }),
    revenueCat: secretApiKey ? createRevenueCatClient(secretApiKey) : null,
  };
}
