// Account rules shared by the app and Edge Functions: what a valid sign-up looks
// like. Limits mirror the profiles table's check constraints in supabase/migrations.

export const ACCOUNT_LIMITS = {
  nameMaxLength: 50,
  emailMaxLength: 254,
  // The one-time code Supabase emails. Its length is a project setting ("Email OTP
  // Length", 6 to 10 digits) the app cannot read, so any length in that range is accepted.
  codeMinLength: 6,
  codeMaxLength: 10,
} as const;

// Deliberately loose: one "@", a dot in the domain, no spaces. The real proof an
// address works is the code sent to it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountField = "firstName" | "lastName" | "email";
export type AccountFieldIssue = "required" | "too_long" | "invalid";
export type AccountFieldErrors = Partial<Record<AccountField, AccountFieldIssue>>;

export interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
}

// Emails compare case-insensitively and people paste them with spaces around.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nameIssue(name: string): AccountFieldIssue | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "required";
  return trimmed.length > ACCOUNT_LIMITS.nameMaxLength ? "too_long" : null;
}

export function emailIssue(email: string): AccountFieldIssue | null {
  const normalized = normalizeEmail(email);
  if (normalized.length === 0) return "required";
  if (normalized.length > ACCOUNT_LIMITS.emailMaxLength) return "too_long";
  return EMAIL_PATTERN.test(normalized) ? null : "invalid";
}

// Every problem with a sign-up form, by field; an empty object means it can be sent.
export function validateSignUp(input: SignUpInput): AccountFieldErrors {
  const errors: AccountFieldErrors = {};
  const firstName = nameIssue(input.firstName);
  const lastName = nameIssue(input.lastName);
  const email = emailIssue(input.email);
  if (firstName) errors.firstName = firstName;
  if (lastName) errors.lastName = lastName;
  if (email) errors.email = email;
  return errors;
}

export interface ProviderName {
  firstName: string;
  lastName: string;
}

// The name a sign-in provider (Apple, Google) hands over, made to fit a profile.
// Providers may send only part of a name, or none after the first sign-in: then there is no name.
export function providerName(givenName: string | null | undefined, familyName: string | null | undefined): ProviderName | null {
  const firstName = (givenName ?? "").trim().slice(0, ACCOUNT_LIMITS.nameMaxLength).trim();
  const lastName = (familyName ?? "").trim().slice(0, ACCOUNT_LIMITS.nameMaxLength).trim();
  return firstName && lastName ? { firstName, lastName } : null;
}

// A code is only digits, as many as Supabase may send; anything else is not worth a round trip.
export function isCompleteCode(code: string): boolean {
  return new RegExp(`^\\d{${ACCOUNT_LIMITS.codeMinLength},${ACCOUNT_LIMITS.codeMaxLength}}$`).test(code);
}
