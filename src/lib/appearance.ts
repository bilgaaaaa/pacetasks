import { ACCENT_IDS, AccentId, PALETTE_IDS, PaletteId } from "./theme";

// Per-device look & layout preferences. Kept on the phone (not in
// user_settings) because light/dark and layout are a property of the device;
// see appearanceStorage.ts for how they're persisted.

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const GROUP_BY_OPTIONS = ["all", "size", "place", "category", "when"] as const;
export type GroupBy = (typeof GROUP_BY_OPTIONS)[number];

// `label`/`hint` describe each grouping in the Today filter sheet and the Settings radio list.
export const GROUP_BY_LABELS: Record<GroupBy, { short: string; label: string; hint: string }> = {
  all: { short: "All", label: "All in one list", hint: "Everything together, in the order you'll do it" },
  size: { short: "Size", label: "By size", hint: "Quick wins first, then the longer ones" },
  place: { short: "Place", label: "By place", hint: "At home · Out & about · At work · Anywhere" },
  category: { short: "Category", label: "By category", hint: "Work · Personal · Shopping · Home · Health" },
  when: { short: "When", label: "By time of day", hint: "Before work · Anytime · After work" },
};

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: "Match phone",
  light: "Light",
  dark: "Dark",
};

export const QUICK_WIN_LIMITS = { min: 1, max: 15 } as const;

export interface AppearancePrefs {
  themeMode: ThemeMode; // "system" follows the phone's light/dark setting
  palette: PaletteId; // color theme; only "sage" uses `accent`
  accent: AccentId;
  groupBy: GroupBy; // how the Today list is split into sections
  quickWinMinutes: number; // tasks this short or shorter count as quick wins
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  themeMode: "system",
  palette: "sage",
  accent: "sage",
  groupBy: "all",
  quickWinMinutes: 5,
};

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

// Reads stored JSON defensively: unknown or corrupt values fall back to defaults field by field.
export function parseAppearance(raw: string | null): AppearancePrefs {
  if (!raw) return DEFAULT_APPEARANCE;
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_APPEARANCE;
    data = parsed;
  } catch {
    return DEFAULT_APPEARANCE;
  }

  const minutes = Number(data.quickWinMinutes);
  return {
    themeMode: pick(THEME_MODES, data.themeMode, DEFAULT_APPEARANCE.themeMode),
    palette: pick(PALETTE_IDS, data.palette, DEFAULT_APPEARANCE.palette),
    accent: pick(ACCENT_IDS, data.accent, DEFAULT_APPEARANCE.accent),
    groupBy: pick(GROUP_BY_OPTIONS, data.groupBy, DEFAULT_APPEARANCE.groupBy),
    quickWinMinutes: Number.isInteger(minutes)
      ? Math.min(QUICK_WIN_LIMITS.max, Math.max(QUICK_WIN_LIMITS.min, minutes))
      : DEFAULT_APPEARANCE.quickWinMinutes,
  };
}
