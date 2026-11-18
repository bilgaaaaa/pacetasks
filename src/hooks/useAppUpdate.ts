import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Application from "expo-application";
import { shouldOfferUpdate, snoozeFor, StoreRelease, UPDATE_CHECK_INTERVAL_MS } from "../lib/appUpdate";
import { fetchStoreRelease } from "../lib/appStoreApi";
import { loadUpdateSnooze, saveUpdateSnooze } from "../lib/appUpdateStorage";
import { getDeviceLocale } from "../lib/deviceContext";
import { openExternalLink } from "../lib/links";
import { isDemoMode } from "../lib/supabase";

export interface AvailableUpdate {
  installedVersion: string;
  release: StoreRelease;
}

// Checks the App Store when the app opens and when it comes back (at most every
// few hours), and exposes a newer version for the update prompt. Only real
// iPhone builds check: the web demo and Expo Go have no store version to compare.
export function useAppUpdate() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    const installedVersion = Application.nativeApplicationVersion;
    const bundleId = Application.applicationId;
    if (Platform.OS !== "ios" || isDemoMode || !installedVersion || !bundleId) return;
    if (Date.now() - lastCheck.current < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck.current = Date.now();

    try {
      const [release, snooze] = await Promise.all([fetchStoreRelease(bundleId, getDeviceLocale()), loadUpdateSnooze()]);
      if (release && shouldOfferUpdate(installedVersion, release, snooze, Date.now())) {
        console.log(`[useAppUpdate] ${release.version} available (installed ${installedVersion})`);
        setUpdate({ installedVersion, release });
      }
    } catch (e) {
      lastCheck.current = 0; // offline or the store didn't answer: try again next time the app opens
      console.warn("[useAppUpdate] store check failed", e);
    }
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [check]);

  // Opens the App Store page; the prompt closes, and comes back next launch if they didn't update.
  const updateNow = useCallback(() => {
    if (!update) return;
    openExternalLink(update.release.storeUrl);
    setUpdate(null);
  }, [update]);

  // Keeps this version quiet for a few days.
  const later = useCallback(() => {
    if (!update) return;
    saveUpdateSnooze(snoozeFor(update.release, Date.now()));
    setUpdate(null);
  }, [update]);

  return { update, updateNow, later };
}
