import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { AppTheme, buildTheme } from "../lib/theme";
import { AppearancePrefs, DEFAULT_APPEARANCE } from "../lib/appearance";
import { loadAppearance, saveAppearance } from "../lib/appearanceStorage";

interface ThemeContextValue {
  theme: AppTheme;
  appearance: AppearancePrefs;
  appearanceLoaded: boolean;
  updateAppearance: (patch: Partial<AppearancePrefs>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Resolves the active theme from the saved appearance prefs and, in "system"
// mode, the phone's light/dark setting (which updates live when it changes).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearance] = useState<AppearancePrefs>(DEFAULT_APPEARANCE);
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppearance().then((prefs) => {
      if (cancelled) return;
      setAppearance(prefs);
      setAppearanceLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persists every change once the stored prefs are in, so defaults never overwrite them.
  useEffect(() => {
    if (appearanceLoaded) saveAppearance(appearance);
  }, [appearance, appearanceLoaded]);

  const updateAppearance = useCallback((patch: Partial<AppearancePrefs>) => {
    setAppearance((prev) => ({ ...prev, ...patch }));
  }, []);

  const scheme =
    appearance.themeMode === "system" ? (systemScheme === "dark" ? "dark" : "light") : appearance.themeMode;
  const theme = useMemo(() => buildTheme(scheme, appearance.accent), [scheme, appearance.accent]);

  const value = useMemo(
    () => ({ theme, appearance, appearanceLoaded, updateAppearance }),
    [theme, appearance, appearanceLoaded, updateAppearance]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

// Theme-aware replacement for a module-level StyleSheet.create: styles are
// built once per theme object and reused until the theme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: AppTheme) => T) {
  const cache = new WeakMap<AppTheme, T>();
  return function useStyles(): T {
    const { theme } = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
