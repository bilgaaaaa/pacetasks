import { z } from "zod";
import { PRO_ENTITLEMENT_ID, PRO_PERIOD_TYPES } from "../../domain/pro.ts";
import type { ProEntitlement, ProPeriodType } from "../../domain/pro.ts";
import type { FetchFn } from "../ai/LLMClient.ts";

const REVENUECAT_API_URL = "https://api.revenuecat.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;

// Fails with this when RevenueCat can't be read; callers keep the stored state.
export class RevenueCatError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "RevenueCatError";
  }
}

// Only the fields PaceTasks reads from GET /v1/subscribers/{app_user_id}.
const subscriberResponseSchema = z.object({
  subscriber: z.object({
    entitlements: z.record(
      z.string(),
      z.object({
        expires_date: z.string().nullable(),
        product_identifier: z.string(),
      })
    ),
    subscriptions: z.record(
      z.string(),
      z.object({
        period_type: z.string().nullish(),
        unsubscribe_detected_at: z.string().nullish(),
      })
    ),
  }),
});

export type RevenueCatSubscriber = z.infer<typeof subscriberResponseSchema>;

// Reads the Pro entitlement out of a subscriber; null when the user never had Pro.
export function proEntitlementFromSubscriber(subscriber: RevenueCatSubscriber): ProEntitlement | null {
  const entitlement = subscriber.subscriber.entitlements[PRO_ENTITLEMENT_ID];
  if (!entitlement) return null;
  const subscription = subscriber.subscriber.subscriptions[entitlement.product_identifier];
  const periodType = (PRO_PERIOD_TYPES as readonly string[]).includes(subscription?.period_type ?? "")
    ? (subscription?.period_type as ProPeriodType)
    : "normal";
  return {
    productId: entitlement.product_identifier,
    periodType,
    expiresAt: entitlement.expires_date,
    willRenew: !subscription?.unsubscribe_detected_at,
  };
}

export interface RevenueCatClient {
  fetchProEntitlement(appUserId: string): Promise<ProEntitlement | null>;
}

// RevenueCat's REST API with the secret key: the source of truth for receipts,
// renewals, refunds and transfers. Never used from the app.
export function createRevenueCatClient(secretApiKey: string, fetchFn: FetchFn = fetch): RevenueCatClient {
  return {
    async fetchProEntitlement(appUserId) {
      let response: Response;
      try {
        response = await fetchFn(`${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(appUserId)}`, {
          method: "GET",
          headers: { authorization: `Bearer ${secretApiKey}`, accept: "application/json" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        throw new RevenueCatError(`RevenueCat unreachable: ${error instanceof Error ? error.message : String(error)}`, null);
      }
      if (!response.ok) throw new RevenueCatError(`RevenueCat answered ${response.status}`, response.status);

      const parsed = subscriberResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new RevenueCatError("RevenueCat returned an unexpected subscriber shape", response.status);
      return proEntitlementFromSubscriber(parsed.data);
    },
  };
}
