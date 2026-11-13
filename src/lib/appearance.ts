import { ACCENT_IDS, AccentId, PALETTE_IDS, PaletteId } from "./theme";
import { Language, LANGUAGE_NAMES, LANGUAGES, localized, msg, t } from "../i18n";

// Per-device look, layout and language preferences. Kept on the phone (not in
// user_settings) because light/dark and layout are a property of the device;
// see appearanceStorage.ts for how they're persisted.

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const GROUP_BY_OPTIONS = ["all", "size", "place", "category", "when"] as const;
export type GroupBy = (typeof GROUP_BY_OPTIONS)[number];

// `label`/`hint` describe each grouping in the Today filter sheet and the Settings radio list.
export const GROUP_BY_LABELS: Record<GroupBy, { label: string; hint: string }> = localized({
  all: { label: msg("All in one list"), hint: msg("Everything together, in the order you'll do it") },
  size: { label: msg("By size"), hint: msg("Quick wins first, then the longer ones") },
  place: { label: msg("By place"), hint: msg("At home · Out & about · At work · Anywhere") },
  category: { label: msg("By category"), hint: msg("Work · Personal · Shopping · Home · Health") },
  when: { label: msg("By time of day"), hint: msg("Before work · Anytime · After work") },
});

export const THEME_MODE_LABELS: Record<ThemeMode, string> = localized({
  system: msg("Match phone"),
  light: msg("Light"),
  dark: msg("Dark"),
});

// The app's language: "system" follows the phone, the others fix it.
export const LANGUAGE_CHOICES = ["system", ...LANGUAGES] as const;
export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number];

// The language choices for Settings; each language is named in itself, the phone option in the app's language.
export function languageChoiceOptions(): { value: LanguageChoice; label: string }[] {
  return LANGUAGE_CHOICES.map((choice) => ({
    value: choice,
    label: choice === "system" ? t("Match phone") : LANGUAGE_NAMES[choice],
  }));
}

// The language to show: the chosen one, or the phone's when the choice is "system".
export function resolveLanguage(choice: LanguageChoice, phoneLanguage: Language): Language {
  return choice === "system" ? phoneLanguage : choice;
}

export const QUICK_WIN_LIMITS = { min: 1, max: 15 } as const;

export interface AppearancePrefs {
  themeMode: ThemeMode; // "system" follows the phone's light/dark setting
  palette: PaletteId; // color theme; only "sage" uses `accent`
  accent: AccentId;
  groupBy: GroupBy; // how the Today list is split into sections
  quickWinMinutes: number; // tasks this short or shorter count as quick wins
  language: LanguageChoice; // "system" follows the phone's language
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  themeMode: "system",
  palette: "sage",
  accent: "sage",
  groupBy: "all",
  quickWinMinutes: 5,
  language: "system",
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
    language: pick(LANGUAGE_CHOICES, data.language, DEFAULT_APPEARANCE.language),
  };
}
