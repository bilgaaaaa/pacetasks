import { PRO_PRODUCT_IDS } from "@domain/pro";
import type { ProEntitlement, ProStatus } from "@domain/pro";
import { buildProPlans } from "../proPlans";
import type { StoreProductInfo } from "../proPlans";
import type { ProStore } from "../purchases";

// In-memory App Store for demo mode: two plans with a 7-day trial, purchases
// that succeed at once, and the same state served to the demo pro-sync call.

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;

const DEMO_PRODUCTS: StoreProductInfo[] = [
  {
    productId: PRO_PRODUCT_IDS.monthly,
    price: 3.99,
    priceString: "€3.99",
    pricePerMonthString: "€3.99",
    introOffer: { price: 0, unit: "WEEK", count: 1 },
  },
  {
    productId: PRO_PRODUCT_IDS.yearly,
    price: 29.99,
    priceString: "€29.99",
    pricePerMonthString: "€2.49",
    introOffer: { price: 0, unit: "WEEK", count: 1 },
  },
];

let entitlement: ProEntitlement | null = null;
let trialUsed = false;
const listeners = new Set<(entitlement: ProEntitlement | null) => void>();

function setEntitlement(next: ProEntitlement | null) {
  entitlement = next;
  listeners.forEach((listener) => listener(next));
}

export function createDemoProStore(): ProStore {
  return {
    available: true,
    identify: () => Promise.resolve(),
    loadPlans: () =>
      Promise.resolve(buildProPlans(DEMO_PRODUCTS, new Set(trialUsed ? [] : DEMO_PRODUCTS.map((p) => p.productId)))),
    readEntitlement: () => Promise.resolve(entitlement),
    purchase: (planId) => {
      const withTrial = !trialUsed;
      trialUsed = true;
      const lengthDays = withTrial ? TRIAL_DAYS : planId === "yearly" ? 365 : 30;
      console.log(`[demoPro] bought ${planId}${withTrial ? " with a trial" : ""}`);
      setEntitlement({
        productId: PRO_PRODUCT_IDS[planId],
        periodType: withTrial ? "trial" : "normal",
        expiresAt: new Date(Date.now() + lengthDays * DAY_MS).toISOString(),
        willRenew: true,
      });
      return Promise.resolve("purchased");
    },
    restore: () => Promise.resolve(entitlement),
    onEntitlementChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// What the demo backend's pro-sync returns: the store's state, with Brain Dump still on the rules.
export function getDemoProStatus(): ProStatus {
  const isPro = entitlement !== null && (entitlement.expiresAt === null || new Date(entitlement.expiresAt) > new Date());
  return { isPro, entitlement, aiBrainDump: false };
}
