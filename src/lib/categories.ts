import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_IDS, CategoryId } from "@domain/categories";
import type { AppTheme } from "./theme";
import { msg, t } from "../i18n";

type CategoryColorKey = "indigo" | "purple" | "warning" | "accentDark" | "pink" | "textTertiary";

export interface Category {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: CategoryColorKey; // theme color, so the tag adapts to light/dark and the accent
}

// Visuals for each shared category id. Typed by CategoryId, so adding an id to
// @domain/categories without visuals here fails the typecheck.
const CATEGORY_VISUALS: Record<CategoryId, Omit<Category, "id">> = {
  work: { label: msg("Work"), icon: "briefcase-outline", colorKey: "indigo" },
  personal: { label: msg("Personal"), icon: "person-outline", colorKey: "purple" },
  shopping: { label: msg("Shopping"), icon: "cart-outline", colorKey: "warning" },
  home: { label: msg("Home"), icon: "home-outline", colorKey: "accentDark" },
  health: { label: msg("Health"), icon: "heart-outline", colorKey: "pink" },
};

// Fixed set of categories (separate from task "timing"). A task's category
// is optional — `null` means "No category".
// Each label is read when shown, so it follows the app's language.
export const CATEGORIES: Category[] = CATEGORY_IDS.map((id) => ({
  id,
  ...CATEGORY_VISUALS[id],
  get label() {
    return t(CATEGORY_VISUALS[id].label);
  },
}));

// Fallback used for a task whose category id no longer matches CATEGORIES
// (e.g. deleted category) or has none set.
export const NO_CATEGORY: Category = {
  id: "none",
  get label() {
    return t("No category");
  },
  icon: "folder-outline",
  colorKey: "textTertiary",
};

export function getCategory(id: string | null): Category {
  if (!id) return NO_CATEGORY;
  return CATEGORIES.find((c) => c.id === id) ?? NO_CATEGORY;
}

export function categoryColor(category: Category, theme: AppTheme): string {
  return theme.colors[category.colorKey];
}
