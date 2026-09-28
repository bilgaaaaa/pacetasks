// Category ids a task can carry (tasks.category). Visuals live in the app's
// src/lib/categories.ts; this list is shared so the AI can only pick valid ids.
export const CATEGORY_IDS = ["work", "personal", "shopping", "home", "health"] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}
