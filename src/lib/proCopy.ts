import type { ProEntitlement } from "@domain/pro";
import type { ProPlan } from "./proPlans";

// Wording for PaceTasks Pro: the paywall, the Settings card and their fine print.
// Kept in one place so what the paywall promises and what the card says never drift.

export const PRO_SECTION_LABEL = "PACETASKS PRO";
export const PRO_EYEBROW = "PACETASKS PRO";
export const PRO_TITLE = "Your tasks, hands-free";
export const PRO_SUBTITLE = "Talk to PaceTasks through Siri while you walk, drive or cook.";

export interface ProFeature {
  icon: "mic-outline" | "arrow-forward-circle-outline" | "sunny-outline" | "sparkles-outline";
  title: string;
  detail: string;
}

// Siri works the same in English, Italian and Turkish, so the paywall says so once.
export const PRO_SIRI_FEATURES: ProFeature[] = [
  {
    icon: "mic-outline",
    title: "Add tasks with Siri",
    detail: "“Hey Siri, add to PaceTasks” — say several at once, in English, Italian or Turkish.",
  },
  {
    icon: "arrow-forward-circle-outline",
    title: "Ask what’s next",
    detail: "“What’s next in PaceTasks?” — Siri picks the one task to do now.",
  },
  {
    icon: "sunny-outline",
    title: "Hear your day",
    detail: "“What’s on today in PaceTasks?” — what’s left and how long it takes.",
  },
];

// Listed only while the server really runs Brain Dump on an AI model for Pro (pro-sync's aiBrainDump).
export const PRO_AI_FEATURE: ProFeature = {
  icon: "sparkles-outline",
  title: "Smarter Brain Dump",
  detail: "Rambling thoughts become clear tasks, read by AI instead of simple rules.",
};

export function proFeatures(aiBrainDump: boolean): ProFeature[] {
  return aiBrainDump ? [...PRO_SIRI_FEATURES, PRO_AI_FEATURE] : PRO_SIRI_FEATURES;
}

export const PRO_PLAN_NAMES: Record<ProPlan["id"], string> = { yearly: "Yearly", monthly: "Monthly" };
const PERIOD_WORD: Record<ProPlan["id"], string> = { yearly: "year", monthly: "month" };

export function planPriceLabel(plan: ProPlan): string {
  return `${plan.priceString} / ${PERIOD_WORD[plan.id]}`;
}

export function planHint(plan: ProPlan): string | null {
  if (plan.perMonthString) return `Just ${plan.perMonthString} a month`;
  return null;
}

export function savingsBadge(plan: ProPlan): string | null {
  return plan.savingsPercent ? `Save ${plan.savingsPercent}%` : null;
}

export function purchaseButtonLabel(plan: ProPlan | null): string {
  if (plan?.trialDays) return `Start my ${plan.trialDays}-day free trial`;
  return "Subscribe";
}

// Apple asks for the price, the period, the trial and how to cancel next to the button.
export function purchaseFinePrint(plan: ProPlan | null): string {
  if (!plan) return "";
  const renewal = `${plan.priceString} a ${PERIOD_WORD[plan.id]}`;
  const cancel = "Cancel anytime in Settings › Apple Account › Subscriptions, at least 24 hours before the period ends.";
  if (plan.trialDays) {
    return `Free for ${plan.trialDays} days, then ${renewal}. Renews automatically. ${cancel} Nothing is charged if you cancel during the trial.`;
  }
  return `${renewal}, renewed automatically. ${cancel}`;
}

export const RESTORE_LABEL = "Restore purchases";
export const MANAGE_LABEL = "Manage subscription";
export const NOTHING_TO_RESTORE = "No PaceTasks Pro purchase was found for this Apple Account.";
export const PRO_UNAVAILABLE_MESSAGE = "Subscriptions aren’t available here. Open PaceTasks on your iPhone to start Pro.";
export const PRO_LOAD_FAILED = "Couldn’t load the plans. Check your connection and try again.";
export const PURCHASE_FAILED = "The purchase didn’t go through. You haven’t been charged — try again.";

export const PRO_WELCOME_TITLE = "Welcome to Pro";
export const PRO_WELCOME_HINT = "Try it now: say “Hey Siri, add to PaceTasks”.";

// The Settings card line under "PaceTasks Pro" for a subscriber.
export function proStatusLine(entitlement: ProEntitlement | null, now: Date): string {
  if (!entitlement?.expiresAt) return "Pro is on.";
  const date = new Date(entitlement.expiresAt);
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const daysLeft = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  if (entitlement.periodType === "trial") {
    return entitlement.willRenew
      ? `Free trial · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left, renews on ${day}`
      : `Free trial · ends on ${day}`;
  }
  return entitlement.willRenew ? `Renews on ${day}` : `Ends on ${day}`;
}

export const PRO_FREE_CARD_TITLE = "Try PaceTasks Pro";
// Mentions the free week only when this user can still take it.
export function proFreeCardSubtitle(trialDays: number | null): string {
  const base = "Add tasks and hear your day with Siri.";
  return trialDays ? `${base} The first ${trialDays} days are free.` : base;
}
export const PRO_FREE_CARD_ACTION = "See Pro";
export const PRO_SIRI_HINT = "Say “Hey Siri, add to PaceTasks”, “What’s next in PaceTasks?” or “What’s on today in PaceTasks?”";
