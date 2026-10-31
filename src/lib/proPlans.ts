import { PRO_PRODUCT_IDS } from "@domain/pro";

// The Pro plans shown in the paywall, built from what the App Store returns.
// Pure, so prices, trial and savings are unit-tested without a store.

export type ProPlanId = keyof typeof PRO_PRODUCT_IDS; // "monthly" | "yearly"

// The parts of a store product the paywall needs; filled from RevenueCat or the demo store.
export interface StoreProductInfo {
  productId: string;
  price: number;
  priceString: string; // already in the user's currency and format, e.g. "€29.99"
  pricePerMonthString: string | null;
  introOffer: { price: number; unit: "DAY" | "WEEK" | "MONTH" | "YEAR" | "UNKNOWN"; count: number } | null;
}

export interface ProPlan {
  id: ProPlanId;
  productId: string;
  priceString: string;
  perMonthString: string | null; // shown under the yearly price only
  savingsPercent: number | null; // yearly vs twelve months of monthly, when it saves at least 1%
  trialDays: number | null; // a free trial this user can still take; null when none or already used
}

// Shown first, and picked by default: the plan most people choose.
export const DEFAULT_PRO_PLAN: ProPlanId = "yearly";

const DAYS_PER_UNIT = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365, UNKNOWN: 0 } as const;

// A free introductory offer, in days; a paid intro price is not a free trial.
export function freeTrialDays(product: StoreProductInfo): number | null {
  const offer = product.introOffer;
  if (!offer || offer.price > 0) return null;
  const days = DAYS_PER_UNIT[offer.unit] * offer.count;
  return days > 0 ? days : null;
}

// Pairs the store products with the two Pro plans, yearly first. Products the
// store didn't return are left out, so a half-configured store still shows what it can.
export function buildProPlans(products: StoreProductInfo[], trialEligibleProductIds: ReadonlySet<string>): ProPlan[] {
  const byId = new Map(products.map((product) => [product.productId, product]));
  const monthly = byId.get(PRO_PRODUCT_IDS.monthly);
  const yearly = byId.get(PRO_PRODUCT_IDS.yearly);

  const plans: ProPlan[] = [];
  if (yearly) {
    plans.push({
      id: "yearly",
      productId: yearly.productId,
      priceString: yearly.priceString,
      perMonthString: yearly.pricePerMonthString,
      savingsPercent: monthly ? yearlySavingsPercent(monthly.price, yearly.price) : null,
      trialDays: trialEligibleProductIds.has(yearly.productId) ? freeTrialDays(yearly) : null,
    });
  }
  if (monthly) {
    plans.push({
      id: "monthly",
      productId: monthly.productId,
      priceString: monthly.priceString,
      perMonthString: null,
      savingsPercent: null,
      trialDays: trialEligibleProductIds.has(monthly.productId) ? freeTrialDays(monthly) : null,
    });
  }
  return plans;
}

// How much cheaper a year is than paying monthly for twelve months, rounded down.
export function yearlySavingsPercent(monthlyPrice: number, yearlyPrice: number): number | null {
  if (monthlyPrice <= 0) return null;
  const percent = Math.floor((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  return percent >= 1 ? percent : null;
}
