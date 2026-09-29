import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_IDS, CategoryId } from "@domain/categories";
import type { AppTheme } from "./theme";

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
  work: { label: "Work", icon: "briefcase-outline", colorKey: "indigo" },
  personal: { label: "Personal", icon: "person-outline", colorKey: "purple" },
  shopping: { label: "Shopping", icon: "cart-outline", colorKey: "warning" },
  home: { label: "Home", icon: "home-outline", colorKey: "accentDark" },
  health: { label: "Health", icon: "heart-outline", colorKey: "pink" },
};

// Fixed set of categories (separate from task "timing"). A task's category
// is optional — `null` means "No category".
export const CATEGORIES: Category[] = CATEGORY_IDS.map((id) => ({ id, ...CATEGORY_VISUALS[id] }));

// Fallback used for a task whose category id no longer matches CATEGORIES
// (e.g. deleted category) or has none set.
export const NO_CATEGORY: Category = {
  id: "none",
  label: "No category",
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
