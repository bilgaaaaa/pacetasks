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

// Providers most people sign up with: an address a slip or two away from one of
// these is far more likely a typo than a real domain. Earlier entries win ties.
const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "icloud.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "live.com",
  "googlemail.com",
  "protonmail.com",
  "proton.me",
  "hotmail.it",
  "outlook.it",
  "yahoo.it",
  "libero.it",
  "virgilio.it",
  "tiscali.it",
  "hotmail.co.uk",
  "yahoo.co.uk",
  "hotmail.fr",
  "orange.fr",
  "hotmail.de",
  "t-online.de",
  "yandex.com",
];

// Real domains one slip from a common one, so they are never "corrected".
const OTHER_KNOWN_EMAIL_DOMAINS = [
  "mail.com",
  "email.com",
  "me.com",
  "mac.com",
  "msn.com",
  "aol.com",
  "ymail.com",
  "pm.me",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "web.de",
  "live.it",
  "tim.it",
];

// Long domains may carry two slips ("icould.com" for "icloud.com"); short ones only one.
const LONG_DOMAIN_LENGTH = 9;

// Edits (insert, delete, replace, or swap two neighbours) needed to turn one string into the other.
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const replace = rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, replace);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

// The likely intended address when the domain is a near miss of a common provider
// ("name@icould.com" → "name@icloud.com"), else null. A code sent to a misspelled
// domain bounces without the app ever knowing, so the form asks before sending.
export function suggestEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (emailIssue(normalized)) return null;

  const at = normalized.lastIndexOf("@");
  const domain = normalized.slice(at + 1);
  if (COMMON_EMAIL_DOMAINS.includes(domain) || OTHER_KNOWN_EMAIL_DOMAINS.includes(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const allowed = candidate.length >= LONG_DOMAIN_LENGTH ? 2 : 1;
    const distance = editDistance(domain, candidate);
    if (distance <= allowed && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${normalized.slice(0, at)}@${best.domain}` : null;
}

// A code is only digits, as many as Supabase may send; anything else is not worth a round trip.
export function isCompleteCode(code: string): boolean {
  return new RegExp(`^\\d{${ACCOUNT_LIMITS.codeMinLength},${ACCOUNT_LIMITS.codeMaxLength}}$`).test(code);
}
