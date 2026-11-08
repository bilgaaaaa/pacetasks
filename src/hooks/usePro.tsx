import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { effectiveProStatus, FREE_STATUS, Plan, PlanId, ProFeature, ProStatus } from "../lib/pro";
import { PRO_PLANS_UNAVAILABLE, PRO_PURCHASE_FAILED, PRO_RESTORE_FAILED, PRO_RESTORE_NOTHING } from "../lib/proCopy";
import { loadProStatus, saveProStatus } from "../lib/proStorage";
import {
  connectPurchases,
  fetchPlans,
  isPurchasesAvailable,
  onProStatusChange,
  purchasePlan,
  restorePurchases,
  showManageSubscriptions,
} from "../lib/purchasesApi";

// What the paywall sheet shows; App renders it once for the whole app.
export interface PaywallState {
  visible: boolean;
  reason: ProFeature | null; // the feature that opened it, or null from Settings
  plans: Plan[] | null; // null while loading
  message: string | null; // a load, purchase or restore problem
  busyPlanId: PlanId | null;
  restoring: boolean;
}

interface ProContextValue {
  isPro: boolean;
  status: ProStatus;
  storeAvailable: boolean; // false where nothing can be bought (web demo, Android, no key): everyone is Pro there
  // Runs `action` for Pro users, otherwise opens the paywall for that feature.
  requirePro: (feature: ProFeature, action: () => void) => void;
  openPaywall: (reason?: ProFeature | null) => void;
  closePaywall: () => void;
  purchase: (planId: PlanId) => Promise<void>;
  restore: () => Promise<void>;
  manageSubscription: () => void;
  paywall: PaywallState;
}

const ProContext = createContext<ProContextValue | null>(null);

const CLOSED_PAYWALL: PaywallState = {
  visible: false,
  reason: null,
  plans: null,
  message: null,
  busyPlanId: null,
  restoring: false,
};

const storeAvailable = isPurchasesAvailable();
if (!storeAvailable) console.log("[usePro] no store in this build, Pro is unlocked");

// Holds the user's Pro status for the whole app: the saved one at once, then the store's answer for this
// PaceTasks account, kept current on foreground and on store updates. Every paywall flow goes through here.
export function ProProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const [live, setLive] = useState<ProStatus | null>(null);
  const [saved, setSaved] = useState<ProStatus | null>(null);
  const [paywall, setPaywall] = useState<PaywallState>(CLOSED_PAYWALL);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const applyLive = useCallback((status: ProStatus) => {
    setLive(status);
    setSaved(status);
    void saveProStatus(status);
  }, []);

  const refreshStatus = useCallback(async () => {
    const id = userIdRef.current;
    if (!storeAvailable || !id) return;
    try {
      applyLive(await connectPurchases(id));
    } catch (e) {
      // Offline or store down: the saved status keeps applying (see effectiveProStatus).
      console.warn("[usePro] could not reach the store", e);
    }
  }, [applyLive]);

  useEffect(() => {
    if (!storeAvailable) return;
    void loadProStatus().then(setSaved);
  }, []);

  // A new account (sign-in, account deleted) starts from the store's answer for that account.
  useEffect(() => {
    setLive(null);
    void refreshStatus();
  }, [userId, refreshStatus]);

  useEffect(() => {
    if (!storeAvailable || !userId) return;
    const unsubscribe = onProStatusChange(applyLive);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshStatus();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [userId, applyLive, refreshStatus]);

  const status = useMemo<ProStatus>(
    () =>
      storeAvailable ? effectiveProStatus(live, saved, Date.now()) : { ...FREE_STATUS, active: true, lifetime: true },
    [live, saved],
  );
  const isPro = status.active;

  const loadPlans = useCallback(async () => {
    setPaywall((current) => ({ ...current, plans: null, message: null }));
    try {
      const plans = await fetchPlans();
      setPaywall((current) => ({
        ...current,
        plans,
        message: plans.length ? null : PRO_PLANS_UNAVAILABLE,
      }));
    } catch (e) {
      console.warn("[usePro] could not load plans", e);
      setPaywall((current) => ({
        ...current,
        plans: [],
        message: PRO_PLANS_UNAVAILABLE,
      }));
    }
  }, []);

  const openPaywall = useCallback(
    (reason: ProFeature | null = null) => {
      console.log(`[usePro] paywall opened${reason ? ` for ${reason}` : ""}`);
      setPaywall({ ...CLOSED_PAYWALL, visible: true, reason });
      if (storeAvailable) void loadPlans();
    },
    [loadPlans],
  );

  const closePaywall = useCallback(() => setPaywall(CLOSED_PAYWALL), []);

  const requirePro = useCallback(
    (feature: ProFeature, action: () => void) => {
      if (isPro) action();
      else openPaywall(feature);
    },
    [isPro, openPaywall],
  );

  const purchase = useCallback(
    async (planId: PlanId) => {
      setPaywall((current) => ({
        ...current,
        busyPlanId: planId,
        message: null,
      }));
      try {
        const result = await purchasePlan(planId);
        if (result.kind === "purchased") applyLive(result.status);
        setPaywall((current) => ({ ...current, busyPlanId: null }));
      } catch (e) {
        console.warn(`[usePro] purchase of ${planId} failed`, e);
        setPaywall((current) => ({
          ...current,
          busyPlanId: null,
          message: PRO_PURCHASE_FAILED,
        }));
      }
    },
    [applyLive],
  );

  const restore = useCallback(async () => {
    setPaywall((current) => ({ ...current, restoring: true, message: null }));
    try {
      const restored = await restorePurchases();
      applyLive(restored);
      setPaywall((current) => ({
        ...current,
        restoring: false,
        message: restored.active ? null : PRO_RESTORE_NOTHING,
      }));
    } catch (e) {
      console.warn("[usePro] restore failed", e);
      setPaywall((current) => ({
        ...current,
        restoring: false,
        message: PRO_RESTORE_FAILED,
      }));
    }
  }, [applyLive]);

  const manageSubscription = useCallback(() => {
    showManageSubscriptions().catch((e) => console.warn("[usePro] could not open subscriptions", e));
  }, []);

  const value = useMemo<ProContextValue>(
    () => ({
      isPro,
      status,
      storeAvailable,
      requirePro,
      openPaywall,
      closePaywall,
      purchase,
      restore,
      manageSubscription,
      paywall,
    }),
    [isPro, status, requirePro, openPaywall, closePaywall, purchase, restore, manageSubscription, paywall],
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProContextValue {
  const context = useContext(ProContext);
  if (!context) throw new Error("usePro must be used inside ProProvider");
  return context;
}
