import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { UserSettings } from "../lib/types";
import * as settingsApi from "../lib/settingsApi";

export type SettingsPatch = Partial<Omit<UserSettings, "user_id" | "updated_at">>;

interface SettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (patch: SettingsPatch) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Loads the current user's settings once for the whole app, so every screen
// reads the same copy and a new user's settings row is created by one caller only.
// They are dropped the moment the user changes, so nothing of the previous user stays.
export function SettingsProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The user the app is on right now: an answer that arrives for an earlier user is ignored.
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  const refresh = useCallback(async () => {
    setSettings((current) => (current?.user_id === userId ? current : null));
    if (!userId) {
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      const data = await settingsApi.fetchOrCreateSettings(userId);
      if (currentUserId.current !== userId) return;
      setSettings(data);
      setError(null);
    } catch (e: any) {
      if (currentUserId.current !== userId) return;
      console.warn("[useSettings] load failed", e);
      setError(e.message ?? "Failed to load settings");
    } finally {
      if (currentUserId.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Never throws: a failure is reported through `error` and resolves false, like useTasks' changes.
  const save = useCallback(
    async (patch: SettingsPatch): Promise<boolean> => {
      if (!userId) return false;
      try {
        const updated = await settingsApi.updateSettings(userId, patch);
        if (currentUserId.current !== userId) return false;
        setSettings(updated);
        setError(null);
        return true;
      } catch (e: any) {
        if (currentUserId.current !== userId) return false;
        console.warn("[useSettings] save failed", e);
        setError(e.message ?? "Couldn't save your settings");
        return false;
      }
    },
    [userId]
  );

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
