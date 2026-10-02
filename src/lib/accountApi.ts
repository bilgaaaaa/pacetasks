import { normalizeEmail } from "@domain/account";
import { ensureSession, supabase } from "./supabase";

// The only file that talks to Supabase about accounts. PaceTasks is
// passwordless: an account is an email proven with a one-time code. Signing up
// attaches that email to the anonymous user the phone already has, so every
// task made before signing up stays with the account.

export interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  marketing_opt_in: boolean; // consent to tips and product news by email; off unless the user turned it on
  marketing_opt_in_at: string | null; // when that consent was given; kept by the database
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Pick<Profile, "first_name" | "last_name" | "marketing_opt_in">;

// "sign_up" turns this phone's anonymous user into an account; "sign_in" opens an existing account.
export type AccountMode = "sign_up" | "sign_in";

export type AccountErrorCode =
  | "email_taken"
  | "no_account"
  | "wrong_code"
  | "too_many_requests"
  | "network"
  | "unknown";

// An account failure the UI can show as-is: `message` is user-facing.
export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AccountError";
  }
}

const ERROR_MESSAGES: Record<AccountErrorCode, string> = {
  email_taken: "That email already has an account. Sign in instead.",
  no_account: "There's no account with that email. Create one instead.",
  wrong_code: "That code is wrong or has expired. Check it or ask for a new one.",
  too_many_requests: "Too many tries. Wait a minute, then try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  unknown: "Something went wrong. Try again.",
};

// Supabase's own error codes (and, for older servers, HTTP statuses) mapped onto ours.
const SUPABASE_ERROR_CODES: Record<string, AccountErrorCode> = {
  email_exists: "email_taken",
  user_already_exists: "email_taken",
  otp_disabled: "no_account", // signInWithOtp without sign-up, for an email that has no user
  user_not_found: "no_account",
  otp_expired: "wrong_code",
  invalid_credentials: "wrong_code",
  over_email_send_rate_limit: "too_many_requests",
  over_request_rate_limit: "too_many_requests",
};
const HTTP_TOO_MANY_REQUESTS = 429;

function toAccountError(action: string, error: unknown): AccountError {
  console.warn(`[accountApi] ${action} failed`, error);
  const { code, status, name } = (error ?? {}) as { code?: string; status?: number; name?: string };
  const mapped: AccountErrorCode =
    (code && SUPABASE_ERROR_CODES[code]) ||
    (status === HTTP_TOO_MANY_REQUESTS ? "too_many_requests" : name === "AuthRetryableFetchError" ? "network" : "unknown");
  return new AccountError(mapped, ERROR_MESSAGES[mapped]);
}

// Emails a six-digit code to prove the address: for sign-up it is the "confirm
// your email" of the current user, for sign-in a login code for an existing account.
// Sign-up details travel in the user's metadata, so the profile can still be
// created if the app is closed between sending the code and entering it.
// Resolves "confirmed" when the project doesn't ask for email confirmation and
// the address was accepted on the spot, so there is no code to wait for.
export async function requestEmailCode(
  mode: AccountMode,
  email: string,
  details?: ProfileInput
): Promise<"code_sent" | "confirmed"> {
  const address = normalizeEmail(email);
  if (mode === "sign_in") {
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    if (error) throw toAccountError("request sign_in code", error);
    return "code_sent";
  }

  const { data, error } = await supabase.auth.updateUser({ email: address, data: details });
  if (error) throw toAccountError("request sign_up code", error);
  return data.user?.email === address ? "confirmed" : "code_sent";
}

// Reads the sign-up details back from a user's metadata; null when they are missing or incomplete.
export function profileInputFromMetadata(metadata: Record<string, unknown> | undefined): ProfileInput | null {
  const { first_name, last_name, marketing_opt_in } = metadata ?? {};
  if (typeof first_name !== "string" || typeof last_name !== "string") return null;
  if (!first_name.trim() || !last_name.trim()) return null;
  return { first_name, last_name, marketing_opt_in: marketing_opt_in === true };
}

// Checks the code. On success the session belongs to the verified account:
// the same user as before for sign-up, the existing account's user for sign-in.
export async function verifyEmailCode(mode: AccountMode, email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: code,
    type: mode === "sign_up" ? "email_change" : "email",
  });
  if (error) throw toAccountError(`verify ${mode} code`, error);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw toAccountError("fetch profile", error);
  return data;
}

// Creates or updates the signed-in user's profile; only a verified account may (row-level security).
export async function saveProfile(userId: string, input: ProfileInput): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw toAccountError("save profile", error);
  return data;
}

// Leaves the account on this phone and starts a fresh anonymous session, so the
// app keeps working. The account and its tasks stay on the server.
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toAccountError("sign out", error);
  await ensureSession();
}
