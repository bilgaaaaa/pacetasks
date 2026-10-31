import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isEntitlementActive } from "@domain/pro";
import type { ProEntitlement, ProStatus } from "@domain/pro";
import { syncProStatus } from "../lib/proApi";
import { NOTHING_TO_RESTORE, PRO_LOAD_FAILED, PURCHASE_FAILED } from "../lib/proCopy";
import type { ProPlan, ProPlanId } from "../lib/proPlans";
import { proStore } from "../lib/purchases";

type PlansState = "loading" | "ready" | "failed";

interface ProContextValue {
  available: boolean; // the App Store can be used on this device and build
  isPro: boolean;
  entitlement: ProEntitlement | null;
  aiBrainDump: boolean; // the server runs Brain Dump on AI for Pro right now
  plans: ProPlan[];
  plansState: PlansState;
  busy: "purchase" | "restore" | null;
  error: string | null; // a failure to show near the action that caused it
  notice: string | null; // a calm message, e.g. nothing to restore
  reloadPlans: () => Promise<void>;
  purchase: (planId: ProPlanId) => Promise<boolean>; // true once the user is Pro
  restore: () => Promise<boolean>;
  clearMessages: () => void;
}

const ProContext = createContext<ProContextValue | null>(null);

// PaceTasks Pro for the whole app: ties the App Store to the current user, keeps
// their subscription and the plans, and copies every change to the server so
// Siri and Brain Dump see it at once. Dropped and reloaded when the user changes.
export function ProProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const [storeEntitlement, setStoreEntitlement] = useState<ProEntitlement | null>(null);
  const [serverStatus, setServerStatus] = useState<ProStatus | null>(null);
  const [plans, setPlans] = useState<ProPlan[]>([]);
  const [plansState, setPlansState] = useState<PlansState>("loading");
  const [busy, setBusy] = useState<ProContextValue["busy"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Answers that arrive for an earlier user are ignored, like useSettings.
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  // Best effort: the app keeps working on the store's answer if the server can't be reached.
  const syncServer = useCallback(async (forUser: string) => {
    try {
      const status = await syncProStatus();
      if (currentUserId.current === forUser) setServerStatus(status);
    } catch {
      // Logged by proApi; the next app start or purchase tries again.
    }
  }, []);

  const reloadPlans = useCallback(async () => {
    if (!proStore.available) {
      setPlansState("ready");
      return;
    }
    setPlansState("loading");
    try {
      const loaded = await proStore.loadPlans();
      setPlans(loaded);
      setPlansState("ready");
    } catch (e) {
      console.warn("[usePro] plans failed to load", e);
      setPlansState("failed");
    }
  }, []);

  useEffect(() => {
    setStoreEntitlement(null);
    setServerStatus(null);
    if (!userId) return;
    let active = true;

    (async () => {
      try {
        await proStore.identify(userId);
        const entitlement = await proStore.readEntitlement();
        if (active) setStoreEntitlement(entitlement);
      } catch (e) {
        console.warn("[usePro] could not read the subscription from the store", e);
      }
      if (active) {
        void syncServer(userId);
        void reloadPlans();
      }
    })();

    // Renewals, refunds and purchases made elsewhere arrive here while the app is open.
    const unsubscribe = proStore.onEntitlementChange((entitlement) => {
      if (!active) return;
      setStoreEntitlement(entitlement);
      void syncServer(userId);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, syncServer, reloadPlans]);

  const purchase = useCallback(
    async (planId: ProPlanId): Promise<boolean> => {
      if (!userId || busy) return false;
      setBusy("purchase");
      setError(null);
      setNotice(null);
      try {
        const outcome = await proStore.purchase(planId);
        if (outcome === "cancelled") {
          console.log("[usePro] purchase cancelled by the user");
          return false;
        }
        const entitlement = await proStore.readEntitlement();
        if (currentUserId.current !== userId) return false;
        setStoreEntitlement(entitlement);
        await syncServer(userId);
        console.log(`[usePro] purchased ${planId}`);
        return isEntitlementActive(entitlement, new Date());
      } catch (e) {
        console.warn("[usePro] purchase failed", e);
        if (currentUserId.current === userId) setError(PURCHASE_FAILED);
        return false;
      } finally {
        if (currentUserId.current === userId) setBusy(null);
      }
    },
    [userId, busy, syncServer]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    if (!userId || busy) return false;
    setBusy("restore");
    setError(null);
    setNotice(null);
    try {
      const entitlement = await proStore.restore();
      if (currentUserId.current !== userId) return false;
      setStoreEntitlement(entitlement);
      await syncServer(userId);
      const restored = isEntitlementActive(entitlement, new Date());
      if (!restored) setNotice(NOTHING_TO_RESTORE);
      return restored;
    } catch (e) {
      console.warn("[usePro] restore failed", e);
      if (currentUserId.current === userId) setError(PRO_LOAD_FAILED);
      return false;
    } finally {
      if (currentUserId.current === userId) setBusy(null);
    }
  }, [userId, busy, syncServer]);

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const entitlement = storeEntitlement ?? serverStatus?.entitlement ?? null;
  const isPro = isEntitlementActive(storeEntitlement, new Date()) || Boolean(serverStatus?.isPro);
  const value = useMemo<ProContextValue>(
    () => ({
      available: proStore.available,
      isPro,
      entitlement,
      aiBrainDump: serverStatus?.aiBrainDump ?? false,
      plans,
      plansState,
      busy,
      error,
      notice,
      reloadPlans,
      purchase,
      restore,
      clearMessages,
    }),
    [isPro, entitlement, serverStatus, plans, plansState, busy, error, notice, reloadPlans, purchase, restore, clearMessages]
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

// The current user's PaceTasks Pro state and actions (see ProProvider).
export function usePro(): ProContextValue {
  const context = useContext(ProContext);
  if (!context) throw new Error("usePro must be used inside ProProvider");
  return context;
}
