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

export function switchModeLabel(mode: AccountMode): string {
  return mode === "sign_up" ? "I already have an account" : "Create a new account instead";
}

export function codePrompt(email: string): string {
  return `Enter the ${ACCOUNT_LIMITS.codeLength}-digit code we sent to ${email}.`;
}

export function doneMessage(mode: AccountMode, firstName: string | null): string {
  if (mode === "sign_in") return firstName ? `Welcome back, ${firstName}.` : "Welcome back.";
  return firstName ? `You're all set, ${firstName}.` : "You're all set.";
}

export const MARKETING_CONSENT_LABEL = "Send me tips and product news by email";
export const MARKETING_CONSENT_HINT = "Optional. You can change this any time in Settings.";
