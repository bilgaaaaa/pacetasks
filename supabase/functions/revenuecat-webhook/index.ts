import { createProSyncDeps } from "../_shared/server/pro/proDeps.ts";
import { handleRevenueCatWebhookHttp } from "../_shared/server/pro/proHttp.ts";

// POST /functions/v1/revenuecat-webhook — called by RevenueCat, not the app, so
// JWT checks are off in config.toml and REVENUECAT_WEBHOOK_AUTH guards it instead.
// Secrets: REVENUECAT_WEBHOOK_AUTH, REVENUECAT_SECRET_API_KEY.

const deps = createProSyncDeps("revenuecat-webhook");

Deno.serve((request) =>
  handleRevenueCatWebhookHttp(request, {
    ...deps,
    expectedAuthorization: Deno.env.get("REVENUECAT_WEBHOOK_AUTH") ?? null,
  })
);
