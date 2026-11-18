// PaceTasks Pro as the server sees it. Must stay in sync with
// public.pro_entitlements in supabase/migrations and the RevenueCat dashboard.

// The RevenueCat entitlement every Pro plan grants (pro_monthly, pro_yearly, pro_lifetime);
// the same value as PRO_ENTITLEMENT in src/lib/pro.ts.
export const PRO_ENTITLEMENT_ID = "pro";

export const PRO_PERIOD_TYPES = ["trial", "intro", "normal"] as const;
export type ProPeriodType = (typeof PRO_PERIOD_TYPES)[number];

// One user's subscription as the server stores it (a row of pro_entitlements).
export interface ProEntitlement {
  productId: string;
  periodType: ProPeriodType;
  expiresAt: string | null; // ISO time; null = never expires (lifetime)
  willRenew: boolean;
}

// What pro-sync returns to the app after refreshing the server's copy.
export interface ProSyncStatus {
  isPro: boolean;
  entitlement: ProEntitlement | null;
}

// An entitlement counts until its expiry; one without an expiry never ends.
export function isEntitlementActive(entitlement: ProEntitlement | null, now: Date): boolean {
  if (!entitlement) return false;
  return entitlement.expiresAt === null || new Date(entitlement.expiresAt).getTime() > now.getTime();
}
