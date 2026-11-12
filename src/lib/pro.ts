// Pure rules for PaceTasks Pro, the one purchase that also unlocks DeskFocus Pro on the Mac.
// The store's answer comes through src/lib/purchasesApi.ts; these functions only decide what it means.

// The RevenueCat entitlement both apps check.
export const PRO_ENTITLEMENT = "pro";

// What a free user hits a paywall for on iPhone. Siri joins once it ships.
export type ProFeature = "brainDump" | "paceHistory" | "siri";

// Product IDs, the same in App Store Connect, RevenueCat and (later) Paddle.
export type PlanId = "pro_monthly" | "pro_yearly" | "pro_lifetime";
export const PLAN_IDS: readonly PlanId[] = ["pro_monthly", "pro_yearly", "pro_lifetime"];

export interface Plan {
  id: PlanId;
  price: string; // localized by the store, e.g. "€19.99"
  trialDays: number | null; // a free trial the user can still get, or null
}

export interface ProStatus {
  active: boolean;
  lifetime: boolean;
  expiresAt: number | null; // ms since epoch; null while free or for lifetime
}

export const FREE_STATUS: ProStatus = {
  active: false,
  lifetime: false,
  expiresAt: null,
};

// How long a saved subscription keeps working without the store's confirmation (offline, store down).
export const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// The status to act on: the store's answer when there is one, otherwise the last one saved on this phone,
// kept a few days past its renewal date so a paying user who is offline is never locked out.
export function effectiveProStatus(live: ProStatus | null, saved: ProStatus | null, nowMs: number): ProStatus {
  if (live) return live;
  if (!saved?.active) return FREE_STATUS;
  if (saved.lifetime || saved.expiresAt === null) return saved;
  return saved.expiresAt + OFFLINE_GRACE_MS > nowMs ? saved : FREE_STATUS;
}

// Maps a store product ID to its plan; anything else (an old or test product) is ignored.
export function planIdOf(productId: string): PlanId | null {
  return (PLAN_IDS as readonly string[]).includes(productId) ? (productId as PlanId) : null;
}

const DAYS_PER_UNIT: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

// Length of a free introductory offer in days; a paid intro price is not a trial.
export function freeTrialDays(
  intro: {
    price: number;
    periodUnit: string;
    periodNumberOfUnits: number;
    cycles: number;
  } | null,
): number | null {
  if (!intro || intro.price > 0) return null;
  const perUnit = DAYS_PER_UNIT[intro.periodUnit.toUpperCase()];
  if (!perUnit) return null;
  return perUnit * intro.periodNumberOfUnits * Math.max(1, intro.cycles);
}

// Plans in the order the paywall shows them; ones the store didn't return are left out.
export function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => PLAN_IDS.indexOf(a.id) - PLAN_IDS.indexOf(b.id));
}
