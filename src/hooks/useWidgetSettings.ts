import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { fetchWidgetSettings, updateWidgetSettings } from "../lib/deskfocusBridge";
import { applyWidgetSettingsPatch, WidgetSettings, WidgetSettingsPatch } from "../lib/widgetSettings";

// The DeskFocus widget's settings while the settings sheet is open: loaded on opening and whenever the app returns
// (a calendar may have been added in the meantime). A change shows at once and is then saved for the widget.
export function useWidgetSettings(active: boolean) {
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    const loaded = await fetchWidgetSettings();
    setSettings(loaded);
    setFailed(loaded === null);
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => subscription.remove();
  }, [active, reload]);

  // A failed save reloads, so the switches go back to what the widget really has.
  const update = useCallback(
    async (patch: WidgetSettingsPatch) => {
      setSettings((current) => current && applyWidgetSettingsPatch(current, patch));
      const saved = await updateWidgetSettings(patch);
      if (saved) {
        setSettings(saved);
        console.log("[useWidgetSettings] saved", Object.keys(patch).join(", "));
      } else {
        console.warn("[useWidgetSettings] save failed, reloading");
        await reload();
      }
    },
    [reload]
  );

  return { settings, failed, reload, update };
}
