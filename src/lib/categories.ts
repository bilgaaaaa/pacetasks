import { Ionicons } from "@expo/vector-icons";
import { theme } from "./theme";

export interface Category {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// Fixed set of categories (separate from task "timing"). A task's category
// is optional — `null` means "No category" and is excluded from the
// Categories filter row, matching the "not mandatory" requirement.
export const CATEGORIES: Category[] = [
  { id: "work", label: "Work", icon: "briefcase-outline", color: theme.colors.indigo },
  { id: "personal", label: "Personal", icon: "person-outline", color: theme.colors.purple },
  { id: "shopping", label: "Shopping", icon: "cart-outline", color: theme.colors.warning },
  { id: "home", label: "Home", icon: "home-outline", color: theme.colors.success },
  { id: "health", label: "Health", icon: "heart-outline", color: theme.colors.pink },
];

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
