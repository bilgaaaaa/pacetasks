import { ACCOUNT_LIMITS } from "@domain/account";
import type { AccountField, AccountFieldIssue } from "@domain/account";
import type { AccountMode } from "./accountApi";

// UI copy for accounts. Rules live in @domain/account and accountState; wording
// lives here so it can be localized later without touching the logic.

const FIELD_LABELS: Record<AccountField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
};

export function fieldLabel(field: AccountField): string {
  return FIELD_LABELS[field];
}

// One short line under a field saying what to fix.
export function fieldErrorLabel(field: AccountField, issue: AccountFieldIssue): string {
  if (issue === "required") return `${FIELD_LABELS[field]} is needed`;
  if (issue === "too_long") {
    return field === "email" ? "That email is too long" : `Keep it under ${ACCOUNT_LIMITS.nameMaxLength} characters`;
  }
  return "That doesn't look like an email address";
}

export function sheetTitle(mode: AccountMode): string {
  return mode === "sign_up" ? "Create your account" : "Welcome back";
}

export function sheetSubtitle(mode: AccountMode): string {
  return mode === "sign_up"
    ? "Your tasks stay exactly as they are. An account keeps them safe if you change or lose your phone. No password: we email you a code."
    : "Enter your account's email and we'll send you a code. Tasks on this phone that aren't in your account stay behind.";
}

// Between the email form and the sign-in providers.
export const PROVIDER_DIVIDER_LABEL = "or";

// Under the Apple button: what happens to this phone's tasks, which differs by mode.
export function appleHint(mode: AccountMode): string {
  return mode === "sign_up"
    ? "Your tasks stay with you. If your Apple ID already has a PaceTasks account, that account opens instead."
    : "Opens the account made with your Apple ID. If there isn't one yet, it creates one and keeps this phone's tasks.";
}

// The email an account shows on its card; Apple can hide the real one behind a relay address.
const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";
export function accountEmailLabel(email: string | null): string {
  if (!email) return "Signed in";
  return email.endsWith(APPLE_RELAY_DOMAIN) ? "Signed in with Apple (email hidden)" : email;
}

export function switchModeLabel(mode: AccountMode): string {
  return mode === "sign_up" ? "I already have an account" : "Create a new account instead";
}

export function codePrompt(email: string): string {
  return `Enter the code we sent to ${email}.`;
}

export function doneMessage(mode: AccountMode, firstName: string | null): string {
  if (mode === "sign_in") return firstName ? `Welcome back, ${firstName}.` : "Welcome back.";
  return firstName ? `You're all set, ${firstName}.` : "You're all set.";
}

export const MARKETING_CONSENT_LABEL = "Send me tips and product news by email";
export const MARKETING_CONSENT_HINT = "Optional. You can change this any time in Settings.";

export const PRIVACY_POLICY_LABEL = "Privacy policy";
export const SUPPORT_LABEL = "Help and support";
// Shown where name and email are collected, so the policy is one tap away before signing up.
export const SIGN_UP_PRIVACY_NOTE = "Your name and email are used only for your account, whether you type them or Apple shares them.";

// --- Deleting the account (or, before sign-up, this phone's data) ---

export function deletionEntryLabel(hasAccount: boolean): string {
  return hasAccount ? "Delete account" : "Delete my data";
}

export function deletionEntryHint(hasAccount: boolean): string {
  return hasAccount
    ? "Removes your account and everything in it from PaceTasks, for good."
    : "Removes every task and setting PaceTasks holds for this phone, for good.";
}

export function deletionTitle(hasAccount: boolean): string {
  return hasAccount ? "Delete your account?" : "Delete your data?";
}

// An account lives on every phone signed in to it; without one, the data belongs to this phone only.
export function deletionIntro(hasAccount: boolean): string {
  return hasAccount ? "This deletes, on every phone you use:" : "This deletes, from this phone and from PaceTasks:";
}

// What goes, one line each, so nothing about the deletion is a surprise.
export function deletionConsequences(hasAccount: boolean): string[] {
  const everything = [
    "Every task, including the ones you finished",
    "Your statistics, streaks and pace history",
    "Your settings and anything you typed into Brain Dump",
  ];
  return hasAccount ? ["Your account, with your name and email", ...everything] : everything;
}

export const DELETION_WARNING = "This can't be undone. This phone starts again empty.";
export const DATA_SECTION_LABEL = "YOUR DATA";
export const DELETION_CANCEL_LABEL = "Keep everything";
export const DELETION_BUSY_LABEL = "Deleting…";

export function deletionConfirmLabel(hasAccount: boolean): string {
  return hasAccount ? "Delete my account" : "Delete my data";
}

export function deletionDoneMessage(hasAccount: boolean): string {
  return hasAccount ? "Your account is deleted." : "Your data is deleted.";
}
