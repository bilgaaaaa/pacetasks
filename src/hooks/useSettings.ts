import { useCallback, useEffect, useState } from "react";
import { UserSettings } from "../lib/types";
import * as settingsApi from "../lib/settingsApi";

// Loads and saves the current user's settings. They are dropped the moment the
// user changes, so a screen never shows or edits the previous user's settings.
export function useSettings(userId: string | undefined) {
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
      setError(e.message ?? "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<Omit<UserSettings, "user_id" | "updated_at">>) => {
      if (!userId) return;
      const updated = await settingsApi.updateSettings(userId, patch);
      setSettings(updated);
    },
    [userId]
  );

  return { settings, loading, error, save };
}
