// PaceTasks Pro, shared by the app and Edge Functions. Must stay in sync with
// public.pro_entitlements in supabase/migrations and the RevenueCat dashboard.

// The RevenueCat entitlement that unlocks Pro; every Pro product grants it.
export const PRO_ENTITLEMENT_ID = "pro";

// App Store product ids sold in the paywall; both start with a 7-day free trial.
export const PRO_PRODUCT_IDS = {
  monthly: "pacetasks_pro_monthly",
  yearly: "pacetasks_pro_yearly",
} as const;

export const PRO_PERIOD_TYPES = ["trial", "intro", "normal"] as const;
export type ProPeriodType = (typeof PRO_PERIOD_TYPES)[number];

// One user's subscription as the server stores it (a row of pro_entitlements).
export interface ProEntitlement {
  productId: string;
  periodType: ProPeriodType;
  expiresAt: string | null; // ISO time; null = never expires
  willRenew: boolean;
}

// What pro-sync returns to the app: the subscription and the Pro features the server offers today.
export interface ProStatus {
  isPro: boolean;
  entitlement: ProEntitlement | null;
  aiBrainDump: boolean; // true once Brain Dump runs on an AI model for Pro users (not the free rules)
}

// An entitlement counts until its expiry; one without an expiry never ends.
export function isEntitlementActive(entitlement: ProEntitlement | null, now: Date): boolean {
  if (!entitlement) return false;
  return entitlement.expiresAt === null || new Date(entitlement.expiresAt).getTime() > now.getTime();
}
