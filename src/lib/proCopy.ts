// Wording for PaceTasks Pro: the paywall, its plan cards and the Settings section.
import { Plan, PlanId, ProFeature, ProStatus } from "./pro";
import { getLocale, localized, msg, t } from "../i18n";

export const PRO_TITLE = msg("PaceTasks Pro");
export const PRO_SUBTITLE = msg("One Pro for PaceTasks on iPhone and DeskFocus on Mac.");

// Why the paywall opened, shown above the plans; null when opened from Settings.
export const PRO_FEATURE_REASONS: Record<ProFeature, string> = localized({
  brainDump: msg("Brain Dump is part of Pro."),
  paceHistory: msg("Your pace over weeks and months is part of Pro."),
  siri: msg("Adding tasks with Siri is part of Pro."),
});

// What every plan includes; the checklist on each card.
export const PRO_INCLUDES: readonly string[] = localized([
  msg("Brain Dump: say everything at once"),
  msg("Your pace over weeks and months"),
  msg("Siri: add tasks by voice (coming soon)"),
  msg("DeskFocus Pro on Mac: Google, app blocking, history"),
]);

export const PLAN_NAMES: Record<PlanId, string> = localized({
  pro_monthly: msg("Monthly"),
  pro_yearly: msg("Yearly"),
  pro_lifetime: msg("Lifetime"),
});

export const PLAN_BADGES: Partial<Record<PlanId, string>> = localized({
  pro_yearly: msg("Best value"),
});

// The price line under a plan's name.
export function planPriceLine(plan: Plan): string {
  switch (plan.id) {
    case "pro_monthly":
      return t("{0} a month", plan.price);
    case "pro_yearly":
      return plan.trialDays ? t("{0} days free, then {1} a year", plan.trialDays, plan.price) : t("{0} a year", plan.price);
    case "pro_lifetime":
      return t("{0} once, yours for good", plan.price);
  }
}

export function planButtonLabel(plan: Plan): string {
  if (plan.id === "pro_lifetime") return t("Buy once");
  return plan.trialDays ? t("Start {0}-day free trial", plan.trialDays) : t("Subscribe");
}

export const PRO_SKIP_LABEL = msg("Not now");
export const PRO_RESTORE_LABEL = msg("Restore purchases");
export const PRO_SEE_PLANS_LABEL = msg("See plans");
export const PRO_MANAGE_LABEL = msg("Manage subscription");
export const PRO_SECTION_LABEL = "PRO";

export const PRO_PLANS_LOADING = msg("Loading plans…");
export const PRO_PLANS_UNAVAILABLE = msg("The plans couldn't load. Check your connection and try again.");
export const PRO_PURCHASE_FAILED = msg("The purchase didn't go through. You were not charged.");
export const PRO_RESTORE_NOTHING = msg("There's no Pro purchase on this Apple ID to restore.");
export const PRO_RESTORE_FAILED = msg("Purchases couldn't be restored. Check your connection and try again.");

// Apple requires this next to auto-renewing subscriptions.
export const PRO_LEGAL =
  msg("Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Payment is charged to your Apple ID. Manage or cancel in your App Store account settings.");
export const PRO_TERMS_LABEL = msg("Terms of Use");
export const PRO_PRIVACY_LABEL = msg("Privacy Policy");

export const PRO_ACTIVE_TITLE = msg("You're Pro");

// One line on what the user has, for the paywall's "You're Pro" panel and Settings.
export function proStatusLine(status: ProStatus): string {
  if (!status.active) return t("Free. Brain Dump and your pace over time come with Pro.");
  if (status.lifetime || status.expiresAt === null) return t("Lifetime: Pro is yours for good, on iPhone and Mac.");
  const date = new Date(status.expiresAt).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return t("Pro on iPhone and Mac. Renews or ends on {0}.", date);
}

// The Pace tab's card where the history starts, for free users.
export const PACE_LOCK_EYEBROW = "PRO";
export const PACE_LOCK_TITLE = msg("Your pace over time");
export const PACE_LOCK_BODY = msg("Streaks, your best hours and days, estimates vs reality, and every day's history.");
