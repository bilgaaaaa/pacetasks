import type { CustomerInfo, PurchasesStoreProduct } from "react-native-purchases";
import { PRO_ENTITLEMENT_ID } from "@domain/pro";
import type { ProEntitlement, ProPeriodType } from "@domain/pro";
import type { StoreProductInfo } from "./proPlans";

// Turns RevenueCat's objects into PaceTasks' own Pro types. Type-only imports,
// so this stays testable without the native SDK.

const PERIOD_TYPE_BY_STORE: Record<string, ProPeriodType> = { TRIAL: "trial", INTRO: "intro", NORMAL: "normal" };

// Reads the Pro entitlement out of RevenueCat's CustomerInfo; null when it isn't active.
export function entitlementFromCustomerInfo(info: Pick<CustomerInfo, "entitlements">): ProEntitlement | null {
  const active = info.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!active) return null;
  return {
    productId: active.productIdentifier,
    periodType: PERIOD_TYPE_BY_STORE[active.periodType] ?? "normal",
    expiresAt: active.expirationDate,
    willRenew: active.willRenew,
  };
}

// Keeps only what the paywall shows from a RevenueCat product.
export function storeProductInfo(product: PurchasesStoreProduct): StoreProductInfo {
  const intro = product.introPrice;
  const unit = intro?.periodUnit;
  return {
    productId: product.identifier,
    price: product.price,
    priceString: product.priceString,
    pricePerMonthString: product.pricePerMonthString,
    introOffer: intro
      ? {
          price: intro.price,
          unit: unit === "DAY" || unit === "WEEK" || unit === "MONTH" || unit === "YEAR" ? unit : "UNKNOWN",
          count: intro.periodNumberOfUnits,
        }
      : null,
  };
}
