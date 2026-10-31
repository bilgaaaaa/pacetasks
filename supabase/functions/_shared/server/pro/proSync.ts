import type { ProEntitlement } from "../../domain/pro.ts";
import type { ProEntitlementStore } from "./proEntitlementStore.ts";
import type { RevenueCatClient } from "./revenueCatClient.ts";

export interface ProSyncDeps {
  store: ProEntitlementStore;
  revenueCat: RevenueCatClient | null; // null until REVENUECAT_SECRET_API_KEY is set
}

// Supabase user ids are UUIDs; RevenueCat's own anonymous ids ("$RCAnonymousID:…") are never ours.
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPaceUserId(appUserId: string): boolean {
  return USER_ID_PATTERN.test(appUserId);
}

// Copies the user's current Pro state from RevenueCat into pro_entitlements and
// returns it. Always reads the latest state instead of trusting one event, so
// retries, out-of-order webhooks, refunds and transfers all end up correct.
// Without RevenueCat configured it returns what is already stored.
export async function syncProEntitlement(userId: string, deps: ProSyncDeps): Promise<ProEntitlement | null> {
  if (!deps.revenueCat) {
    console.warn("[proSync] REVENUECAT_SECRET_API_KEY is not set; returning the stored entitlement");
    return deps.store.read(userId);
  }
  const entitlement = await deps.revenueCat.fetchProEntitlement(userId);
  await deps.store.save(userId, entitlement);
  console.info(
    JSON.stringify({
      event: "pro_synced",
      userId,
      productId: entitlement?.productId ?? null,
      periodType: entitlement?.periodType ?? null,
      expiresAt: entitlement?.expiresAt ?? null,
    })
  );
  return entitlement;
}
