import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { PRO_PRODUCT_IDS } from "@domain/pro";
import type { ProEntitlement } from "@domain/pro";
import { buildProPlans } from "./proPlans";
import type { ProPlan, ProPlanId } from "./proPlans";
import { entitlementFromCustomerInfo, storeProductInfo } from "./proStoreMapping";
import { isDemoMode } from "./supabase";

// The App Store side of PaceTasks Pro behind one small interface: RevenueCat on
// an iPhone build, an in-memory store in demo mode, and "unavailable" elsewhere.

export type PurchaseOutcome = "purchased" | "cancelled";

export interface ProStore {
  readonly available: boolean; // false on the web, Android, or a build without a RevenueCat key
  identify(userId: string): Promise<void>; // ties purchases to the Supabase user
  loadPlans(): Promise<ProPlan[]>;
  readEntitlement(): Promise<ProEntitlement | null>;
  purchase(planId: ProPlanId): Promise<PurchaseOutcome>;
  restore(): Promise<ProEntitlement | null>;
  onEntitlementChange(listener: (entitlement: ProEntitlement | null) => void): () => void;
}

const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

function createRevenueCatStore(): ProStore {
  // Required lazily, so tests and the web build never load the native module.
  const Purchases = (require("react-native-purchases") as typeof import("react-native-purchases")).default;
  const { INTRO_ELIGIBILITY_STATUS, LOG_LEVEL, PURCHASES_ERROR_CODE } =
    require("react-native-purchases") as typeof import("react-native-purchases");

  let configured = false;
  const packagesByPlan = new Map<ProPlanId, PurchasesPackage>();

  return {
    available: true,

    async identify(userId) {
      if (!configured) {
        void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
        Purchases.configure({ apiKey: revenueCatApiKey, appUserID: userId });
        configured = true;
        console.log("[purchases] RevenueCat configured");
        return;
      }
      // Signing in to another account: RevenueCat moves this phone's purchases along.
      await Purchases.logIn(userId);
      console.log("[purchases] RevenueCat user switched");
    },

    async loadPlans() {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      packagesByPlan.clear();
      for (const pkg of packages) {
        const planId = (Object.keys(PRO_PRODUCT_IDS) as ProPlanId[]).find((id) => PRO_PRODUCT_IDS[id] === pkg.product.identifier);
        if (planId) packagesByPlan.set(planId, pkg);
      }
      const productIds = [...packagesByPlan.values()].map((pkg) => pkg.product.identifier);
      const eligibility = productIds.length > 0 ? await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds) : {};
      const eligible = new Set(
        Object.entries(eligibility)
          .filter(([, value]) => value.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE)
          .map(([productId]) => productId)
      );
      console.log(`[purchases] loaded ${packagesByPlan.size} plan(s), ${eligible.size} with a trial`);
      return buildProPlans([...packagesByPlan.values()].map((pkg) => storeProductInfo(pkg.product)), eligible);
    },

    async readEntitlement() {
      return entitlementFromCustomerInfo(await Purchases.getCustomerInfo());
    },

    async purchase(planId) {
      const pkg = packagesByPlan.get(planId);
      if (!pkg) throw new Error(`No package loaded for the ${planId} plan`);
      try {
        await Purchases.purchasePackage(pkg);
        return "purchased";
      } catch (e) {
        if ((e as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "cancelled";
        throw e;
      }
    },

    async restore() {
      return entitlementFromCustomerInfo(await Purchases.restorePurchases());
    },

    onEntitlementChange(listener) {
      const onUpdate = (info: CustomerInfo) => listener(entitlementFromCustomerInfo(info));
      Purchases.addCustomerInfoUpdateListener(onUpdate);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(onUpdate);
      };
    },
  };
}

const unavailableStore: ProStore = {
  available: false,
  identify: () => Promise.resolve(),
  loadPlans: () => Promise.resolve([]),
  readEntitlement: () => Promise.resolve(null),
  purchase: () => Promise.reject(new Error("Subscriptions are not available here")),
  restore: () => Promise.resolve(null),
  onEntitlementChange: () => () => {},
};

function createProStore(): ProStore {
  if (isDemoMode) {
    const { createDemoProStore } = require("./demo/demoPro") as typeof import("./demo/demoPro");
    return createDemoProStore();
  }
  if (Platform.OS !== "ios") return unavailableStore;
  if (!revenueCatApiKey) {
    console.warn("[purchases] EXPO_PUBLIC_REVENUECAT_IOS_KEY is not set; Pro can't be bought in this build");
    return unavailableStore;
  }
  return createRevenueCatStore();
}

export const proStore: ProStore = createProStore();
