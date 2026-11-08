// Wording for PaceTasks Pro: the paywall, its plan cards and the Settings section.
import { Plan, PlanId, ProFeature, ProStatus } from "./pro";

export const PRO_TITLE = "PaceTasks Pro";
export const PRO_SUBTITLE = "One Pro for PaceTasks on iPhone and DeskFocus on Mac.";

// Why the paywall opened, shown above the plans; null when opened from Settings.
export const PRO_FEATURE_REASONS: Record<ProFeature, string> = {
  brainDump: "Brain Dump is part of Pro.",
  paceHistory: "Your pace over weeks and months is part of Pro.",
  siri: "Adding tasks with Siri is part of Pro.",
};

// What every plan includes; the checklist on each card.
export const PRO_INCLUDES: readonly string[] = [
  "Brain Dump: say everything at once",
  "Your pace over weeks and months",
  "Siri: add tasks by voice (coming soon)",
  "DeskFocus Pro on Mac: Google, app blocking, history",
];

export const PLAN_NAMES: Record<PlanId, string> = {
  pro_monthly: "Monthly",
  pro_yearly: "Yearly",
  pro_lifetime: "Lifetime",
};

export const PLAN_BADGES: Partial<Record<PlanId, string>> = {
  pro_yearly: "Best value",
};

// The price line under a plan's name.
export function planPriceLine(plan: Plan): string {
  switch (plan.id) {
    case "pro_monthly":
      return `${plan.price} a month`;
    case "pro_yearly":
      return plan.trialDays ? `${plan.trialDays} days free, then ${plan.price} a year` : `${plan.price} a year`;
    case "pro_lifetime":
      return `${plan.price} once, yours for good`;
  }
}

export function planButtonLabel(plan: Plan): string {
  if (plan.id === "pro_lifetime") return "Buy once";
  return plan.trialDays ? `Start ${plan.trialDays}-day free trial` : "Subscribe";
}

export const PRO_SKIP_LABEL = "Not now";
export const PRO_RESTORE_LABEL = "Restore purchases";
export const PRO_SEE_PLANS_LABEL = "See plans";
export const PRO_MANAGE_LABEL = "Manage subscription";
export const PRO_SECTION_LABEL = "PRO";

export const PRO_PLANS_LOADING = "Loading plans…";
export const PRO_PLANS_UNAVAILABLE = "The plans couldn't load. Check your connection and try again.";
export const PRO_PURCHASE_FAILED = "The purchase didn't go through. You were not charged.";
export const PRO_RESTORE_NOTHING = "There's no Pro purchase on this Apple ID to restore.";
export const PRO_RESTORE_FAILED = "Purchases couldn't be restored. Check your connection and try again.";

// Apple requires this next to auto-renewing subscriptions.
export const PRO_LEGAL =
  "Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Payment is charged to your Apple ID. Manage or cancel in your App Store account settings.";
export const PRO_TERMS_LABEL = "Terms of Use";
export const PRO_PRIVACY_LABEL = "Privacy Policy";

export const PRO_ACTIVE_TITLE = "You're Pro";

// One line on what the user has, for the paywall's "You're Pro" panel and Settings.
export function proStatusLine(status: ProStatus): string {
  if (!status.active) return "Free. Brain Dump and your pace over time come with Pro.";
  if (status.lifetime || status.expiresAt === null) return "Lifetime: Pro is yours for good, on iPhone and Mac.";
  const date = new Date(status.expiresAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Pro on iPhone and Mac. Renews or ends on ${date}.`;
}

// The Pace tab's card where the history starts, for free users.
export const PACE_LOCK_EYEBROW = "PRO";
export const PACE_LOCK_TITLE = "Your pace over time";
export const PACE_LOCK_BODY = "Streaks, your best hours and days, estimates vs reality, and every day's history.";
