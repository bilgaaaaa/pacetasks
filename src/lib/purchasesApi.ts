// The only caller of RevenueCat (react-native-purchases). The app user ID is the PaceTasks (Supabase) user ID,
// so the same Pro unlocks DeskFocus on the Mac once it signs in to that account.
import { Platform } from "react-native";
import Purchases, { CustomerInfo, PURCHASES_ERROR_CODE, PurchasesPackage } from "react-native-purchases";
import { FREE_STATUS, freeTrialDays, Plan, PlanId, planIdOf, PRO_ENTITLEMENT, ProStatus, sortPlans } from "./pro";
import { isDemoMode } from "./supabase";

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

// The packages behind the plans last shown, so a purchase buys exactly what the user saw.
const packagesByPlan = new Map<PlanId, PurchasesPackage>();
let configuredUserId: string | null = null;

// False on the web demo, Android and builds without a RevenueCat key; the app then treats everyone as Pro.
export function isPurchasesAvailable(): boolean {
  return Platform.OS === "ios" && !isDemoMode && API_KEY.length > 0;
}

function statusFrom(info: CustomerInfo): ProStatus {
  const entitlement = info.entitlements.active[PRO_ENTITLEMENT];
  if (!entitlement) return FREE_STATUS;
  const expiresAt = entitlement.expirationDateMillis ?? null;
  return { active: true, lifetime: expiresAt === null, expiresAt };
}

// Configures RevenueCat for this user on first use, switches user when the account changes, and returns their status.
export async function connectPurchases(appUserId: string): Promise<ProStatus> {
  if (configuredUserId === null) {
    Purchases.configure({ apiKey: API_KEY, appUserID: appUserId });
    configuredUserId = appUserId;
    console.log("[purchasesApi] configured");
  } else if (configuredUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredUserId = appUserId;
    console.log("[purchasesApi] switched user");
  }
  return statusFrom(await Purchases.getCustomerInfo());
}

// The plans in the current offering, in the paywall's order.
export async function fetchPlans(): Promise<Plan[]> {
  const offerings = await Purchases.getOfferings();
  packagesByPlan.clear();
  const plans: Plan[] = [];
  for (const pack of offerings.current?.availablePackages ?? []) {
    const id = planIdOf(pack.product.identifier);
    if (!id) continue;
    packagesByPlan.set(id, pack);
    plans.push({
      id,
      price: pack.product.priceString,
      trialDays: freeTrialDays(pack.product.introPrice),
    });
  }
  console.log(`[purchasesApi] ${plans.length} plan(s) loaded`);
  return sortPlans(plans);
}

export type PurchaseResult = { kind: "purchased"; status: ProStatus } | { kind: "cancelled" };

// Buys a plan shown by fetchPlans; a cancel in Apple's sheet is a normal outcome, not an error.
export async function purchasePlan(planId: PlanId): Promise<PurchaseResult> {
  const pack = packagesByPlan.get(planId);
  if (!pack) throw new Error(`plan ${planId} is not loaded`);
  try {
    const { customerInfo } = await Purchases.purchasePackage(pack);
    console.log(`[purchasesApi] bought ${planId}`);
    return { kind: "purchased", status: statusFrom(customerInfo) };
  } catch (e) {
    if ((e as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { kind: "cancelled" };
    throw e;
  }
}

export async function restorePurchases(): Promise<ProStatus> {
  const status = statusFrom(await Purchases.restorePurchases());
  console.log(`[purchasesApi] restore found ${status.active ? "Pro" : "nothing"}`);
  return status;
}

// Calls `listener` when the status changes outside a purchase here (renewal, refund, a buy on another device).
export function onProStatusChange(listener: (status: ProStatus) => void): () => void {
  const handler = (info: CustomerInfo) => listener(statusFrom(info));
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(handler);
  };
}

// Apple's own subscription screen, where the user changes plan or cancels.
export async function showManageSubscriptions(): Promise<void> {
  await Purchases.showManageSubscriptions();
}
