import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import { isDeskfocusSettingsUrl } from "../lib/widgetSettings";

interface DeskfocusSettingsContextValue {
  visible: boolean;
  open: () => void;
  close: () => void;
}

const DeskfocusSettingsContext = createContext<DeskfocusSettingsContextValue | null>(null);

// Whether the DeskFocus settings sheet is open, for the whole app: Settings opens it, and so does the gear on the
// widget, whose link can launch PaceTasks or reach it while it is running. App renders the sheet once.
export function DeskfocusSettingsProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    console.log("[useDeskfocusSettings] settings opened");
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const openFromLink = (url: string | null) => {
      if (url && isDeskfocusSettingsUrl(url)) open();
    };
    Linking.getInitialURL()
      .then(openFromLink)
      .catch((e) => console.warn("[useDeskfocusSettings] could not read the launch link", e));
    const subscription = Linking.addEventListener("url", ({ url }) => openFromLink(url));
    return () => subscription.remove();
  }, [open]);

  const value = useMemo(() => ({ visible, open, close }), [visible, open, close]);
  return <DeskfocusSettingsContext.Provider value={value}>{children}</DeskfocusSettingsContext.Provider>;
}

export function useDeskfocusSettings(): DeskfocusSettingsContextValue {
  const context = useContext(DeskfocusSettingsContext);
  if (!context) throw new Error("useDeskfocusSettings must be used inside DeskfocusSettingsProvider");
  return context;
}
