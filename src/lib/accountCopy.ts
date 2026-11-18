import { ACCOUNT_LIMITS } from "@domain/account";
import type { AccountField, AccountFieldIssue } from "@domain/account";
import type { AccountMode } from "./accountApi";
import { localized, msg, t } from "../i18n";

// UI copy for accounts. Rules live in @domain/account and accountState; wording
// lives here so it can be localized later without touching the logic.

const FIELD_LABELS: Record<AccountField, string> = localized({
  firstName: msg("First name"),
  lastName: msg("Last name"),
  email: msg("Email"),
});

// One sentence per field: the wording changes with the field in other languages.
const FIELD_REQUIRED: Record<AccountField, string> = localized({
  firstName: msg("First name is needed"),
  lastName: msg("Last name is needed"),
  email: msg("Email is needed"),
});

export function fieldLabel(field: AccountField): string {
  return FIELD_LABELS[field];
}

// One short line under a field saying what to fix.
export function fieldErrorLabel(field: AccountField, issue: AccountFieldIssue): string {
  if (issue === "required") return FIELD_REQUIRED[field];
  if (issue === "too_long") {
    return field === "email" ? t("That email is too long") : t("Keep it under {0} characters", ACCOUNT_LIMITS.nameMaxLength);
  }
  return t("That doesn't look like an email address");
}

export function sheetTitle(mode: AccountMode): string {
  return mode === "sign_up" ? t("Create your account") : t("Welcome back");
}

export function sheetSubtitle(mode: AccountMode): string {
  return mode === "sign_up"
    ? t("Your tasks stay exactly as they are. An account keeps them safe if you change or lose your phone. No password: we email you a code.")
    : t("Enter your account's email and we'll send you a code. Tasks on this phone that aren't in your account stay behind.");
}

// Between the email form and the sign-in providers.
export const PROVIDER_DIVIDER_LABEL = "or";

// Under the Apple button: what happens to this phone's tasks, which differs by mode.
export function appleHint(mode: AccountMode): string {
  return mode === "sign_up"
    ? t("Your tasks stay with you. If your Apple ID already has a PaceTasks account, that account opens instead.")
    : t("Opens the account made with your Apple ID. If there isn't one yet, it creates one and keeps this phone's tasks.");
}

// The email an account shows on its card; Apple can hide the real one behind a relay address.
const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";
export function accountEmailLabel(email: string | null): string {
  if (!email) return t("Signed in");
  return email.endsWith(APPLE_RELAY_DOMAIN) ? t("Signed in with Apple (email hidden)") : email;
}

export function switchModeLabel(mode: AccountMode): string {
  return mode === "sign_up" ? t("I already have an account") : t("Create a new account instead");
}

export function codePrompt(email: string): string {
  return t("Enter the code we sent to {0}.", email);
}

export function doneMessage(mode: AccountMode, firstName: string | null): string {
  if (mode === "sign_in") return firstName ? t("Welcome back, {0}.", firstName) : t("Welcome back.");
  return firstName ? t("You're all set, {0}.", firstName) : t("You're all set.");
}

export const MARKETING_CONSENT_LABEL = msg("Send me tips and product news by email");
// GDPR consent has to be informed, so the hint names the sender and the frequency.
export const MARKETING_CONSENT_HINT =
  msg("Optional. Short emails from PaceTasks only, at most one every day or two. You can switch them off in Settings at any time.");

export const PRIVACY_POLICY_LABEL = msg("Privacy policy");
export const SUPPORT_LABEL = msg("Help and support");
// Shown where name and email are collected, so the policy is one tap away before signing up.
export const SIGN_UP_PRIVACY_NOTE = msg("Your name and email are used only for your account, whether you type them or Apple shares them.");

// --- Deleting the account (or, before sign-up, this phone's data) ---

export function deletionEntryLabel(hasAccount: boolean): string {
  return hasAccount ? t("Delete account") : t("Delete my data");
}

export function deletionEntryHint(hasAccount: boolean): string {
  return hasAccount
    ? t("Removes your account and everything in it from PaceTasks, for good.")
    : t("Removes every task and setting PaceTasks holds for this phone, for good.");
}

export function deletionTitle(hasAccount: boolean): string {
  return hasAccount ? t("Delete your account?") : t("Delete your data?");
}

// An account lives on every phone signed in to it; without one, the data belongs to this phone only.
export function deletionIntro(hasAccount: boolean): string {
  return hasAccount ? t("This deletes, on every phone you use:") : t("This deletes, from this phone and from PaceTasks:");
}

// What goes, one line each, so nothing about the deletion is a surprise.
export function deletionConsequences(hasAccount: boolean): string[] {
  const everything = [
    t("Every task, including the ones you finished"),
    t("Your statistics, streaks and pace history"),
    t("Your settings and anything you typed into Brain Dump"),
  ];
  return hasAccount ? [t("Your account, with your name and email"), ...everything] : everything;
}

export const DELETION_WARNING = msg("This can't be undone. This phone starts again empty.");
export const DATA_SECTION_LABEL = msg("YOUR DATA");
export const DELETION_CANCEL_LABEL = msg("Keep everything");
export const DELETION_BUSY_LABEL = msg("Deleting…");

export function deletionConfirmLabel(hasAccount: boolean): string {
  return hasAccount ? t("Delete my account") : t("Delete my data");
}

export function deletionDoneMessage(hasAccount: boolean): string {
  return hasAccount ? t("Your account is deleted.") : t("Your data is deleted.");
}
