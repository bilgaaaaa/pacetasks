import { Ionicons } from "@expo/vector-icons";
import { theme } from "./theme";
import { CATEGORY_IDS, CategoryId } from "@domain/categories";

export interface Category {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// Visuals for each shared category id. Typed by CategoryId, so adding an id to
// @domain/categories without visuals here fails the typecheck.
const CATEGORY_VISUALS: Record<CategoryId, Omit<Category, "id">> = {
  work: { label: "Work", icon: "briefcase-outline", color: theme.colors.indigo },
  personal: { label: "Personal", icon: "person-outline", color: theme.colors.purple },
  shopping: { label: "Shopping", icon: "cart-outline", color: theme.colors.warning },
  home: { label: "Home", icon: "home-outline", color: theme.colors.success },
  health: { label: "Health", icon: "heart-outline", color: theme.colors.pink },
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
  color: theme.colors.textTertiary,
};

export function getCategory(id: string | null): Category {
  if (!id) return NO_CATEGORY;
  return CATEGORIES.find((c) => c.id === id) ?? NO_CATEGORY;
}
