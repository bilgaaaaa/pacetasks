import { z } from "zod";
import { isEntitlementActive } from "../../domain/pro.ts";
import type { ProStatus } from "../../domain/pro.ts";
import { ApiError, CORS_HEADERS, errorResponse, jsonResponse } from "../http/apiError.ts";
import { isPaceUserId, syncProEntitlement } from "./proSync.ts";
import type { ProSyncDeps } from "./proSync.ts";

export interface ProSyncHandlerDeps extends ProSyncDeps {
  authenticate: (authorizationHeader: string) => Promise<string | null>; // the caller's user id
  aiBrainDump: () => boolean; // whether Pro Brain Dump runs on an AI model right now
  now: () => Date;
}

// POST /pro-sync — the app calls it after a purchase or restore (and when it opens)
// so Siri and the server see Pro at once, without waiting for RevenueCat's webhook.
export async function handleProSyncHttp(request: Request, deps: ProSyncHandlerDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  try {
    if (request.method !== "POST") throw new ApiError(405, "method_not_allowed", "Use POST");
    const authorization = request.headers.get("authorization");
    const userId = authorization ? await deps.authenticate(authorization) : null;
    if (!userId) throw new ApiError(401, "unauthorized", "Sign in to check PaceTasks Pro");

    const entitlement = await syncProEntitlement(userId, deps);
    const status: ProStatus = {
      isPro: isEntitlementActive(entitlement, deps.now()),
      entitlement,
      aiBrainDump: deps.aiBrainDump(),
    };
    return jsonResponse(200, status);
  } catch (error) {
    const apiError =
      error instanceof ApiError ? error : new ApiError(503, "pro_unavailable", "Couldn't check PaceTasks Pro — try again", true);
    console.error(JSON.stringify({ event: "pro_sync_failed", code: apiError.code, cause: describe(error) }));
    return errorResponse(apiError);
  }
}

// Only the fields of a RevenueCat webhook event that decide whose state to refresh.
const webhookSchema = z.object({
  event: z.object({
    id: z.string().optional(),
    type: z.string(),
    app_user_id: z.string().optional(),
    transferred_from: z.array(z.string()).nullish(),
    transferred_to: z.array(z.string()).nullish(),
  }),
});

export interface RevenueCatWebhookDeps extends ProSyncDeps {
  expectedAuthorization: string | null; // REVENUECAT_WEBHOOK_AUTH, also typed into the RevenueCat dashboard
}

// POST /revenuecat-webhook — RevenueCat reports a purchase, renewal, cancellation,
// refund or transfer. Each affected PaceTasks user is re-synced from RevenueCat.
export async function handleRevenueCatWebhookHttp(request: Request, deps: RevenueCatWebhookDeps): Promise<Response> {
  if (request.method !== "POST") return errorResponse(new ApiError(405, "method_not_allowed", "Use POST"));
  if (!deps.expectedAuthorization) {
    console.error("[revenuecat-webhook] REVENUECAT_WEBHOOK_AUTH is not set; refusing every call");
    return errorResponse(new ApiError(500, "not_configured", "Webhook is not configured"));
  }
  if (!timingSafeEqual(request.headers.get("authorization") ?? "", deps.expectedAuthorization)) {
    return errorResponse(new ApiError(401, "unauthorized", "Wrong webhook authorization"));
  }

  const parsed = webhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new ApiError(400, "invalid_event", "Unexpected webhook body"));
  const event = parsed.data.event;

  const userIds = affectedUserIds(event);
  // One failing user must not hide the others from RevenueCat's retry: report 500 if any failed.
  const failures: string[] = [];
  for (const userId of userIds) {
    try {
      await syncProEntitlement(userId, deps);
    } catch (error) {
      failures.push(userId);
      console.error(JSON.stringify({ event: "revenuecat_webhook_sync_failed", userId, cause: describe(error) }));
    }
  }
  console.info(JSON.stringify({ event: "revenuecat_webhook", type: event.type, eventId: event.id, users: userIds.length, failures: failures.length }));
  if (failures.length > 0) return errorResponse(new ApiError(500, "sync_failed", "Some users could not be synced", true));
  return jsonResponse(200, { ok: true });
}

// A transfer moves Pro between users, so both sides are refreshed; any other event concerns one user.
export function affectedUserIds(event: z.infer<typeof webhookSchema>["event"]): string[] {
  const candidates =
    event.type === "TRANSFER"
      ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]
      : [event.app_user_id ?? ""];
  return [...new Set(candidates.filter(isPaceUserId))];
}

// Compares secrets in constant time for equal lengths, so the check leaks nothing through timing.
function timingSafeEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function describe(error: unknown): unknown {
  if (error instanceof ApiError) return { code: error.code };
  return error instanceof Error ? { name: error.name, message: error.message } : String(error);
}
