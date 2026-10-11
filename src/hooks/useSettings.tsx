import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UserSettings } from "../lib/types";
import * as settingsApi from "../lib/settingsApi";

export type SettingsPatch = Partial<Omit<UserSettings, "user_id" | "updated_at">>;

interface SettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (patch: SettingsPatch) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Loads the current user's settings once for the whole app, so every screen
// reads the same copy and a new user's settings row is created by one caller only.
// They are dropped the moment the user changes, so nothing of the previous user stays.
export function SettingsProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSettings((current) => (current?.user_id === userId ? current : null));
    if (!userId) return;
    try {
      setLoading(true);
      const data = await settingsApi.fetchOrCreateSettings(userId);
      setSettings(data);
      setError(null);
    } catch (e: any) {
      console.warn("[useSettings] load failed", e);
      setError(e.message ?? "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: SettingsPatch) => {
      if (!userId) return;
      const updated = await settingsApi.updateSettings(userId, patch);
      setSettings(updated);
    },
    [userId]
  );

  // A load that finished for the previous user must not be shown to the next one.
  const current = settings?.user_id === userId ? settings : null;
  const value = useMemo(
    () => ({ settings: current, loading, error, refresh, save }),
    [current, loading, error, refresh, save]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// The current user's settings, shared by every screen (see SettingsProvider).
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
