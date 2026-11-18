import { emailIssue, validateSignUp } from "@domain/account";
import type { AccountField, AccountFieldErrors } from "@domain/account";
import type { AccountMode } from "./accountApi";

// State machine behind the account sheet, kept pure so every transition is
// unit-tested; useAccount only performs the network calls around it.

// "connecting" is the wait while a sign-in provider (Apple) shows its own screen and answers.
export type AccountPhase = "form" | "sending" | "connecting" | "code" | "verifying" | "done";

export interface AccountState {
  mode: AccountMode;
  phase: AccountPhase;
  firstName: string;
  lastName: string;
  email: string;
  marketingOptIn: boolean; // starts off: consent is never pre-ticked
  code: string;
  fieldErrors: AccountFieldErrors;
  error: string | null; // user-facing message from the last failed request
}

export type AccountAction =
  | { type: "opened"; mode: AccountMode }
  | { type: "setMode"; mode: AccountMode }
  | { type: "setField"; field: AccountField; value: string }
  | { type: "setMarketingOptIn"; value: boolean }
  | { type: "submitRejected"; fieldErrors: AccountFieldErrors }
  | { type: "sendStarted" }
  | { type: "codeSent" }
  | { type: "setCode"; code: string }
  | { type: "verifyStarted" }
  | { type: "verified"; mode?: AccountMode } // a provider reports which it turned out to be: a new account or an existing one
  | { type: "providerStarted" }
  | { type: "providerCanceled" }
  | { type: "failed"; message: string }
  | { type: "editEmail" };

export const INITIAL_ACCOUNT_STATE: AccountState = {
  mode: "sign_up",
  phase: "form",
  firstName: "",
  lastName: "",
  email: "",
  marketingOptIn: false,
  code: "",
  fieldErrors: {},
  error: null,
};

// What is wrong with the form for the current mode; signing in only needs the email.
export function formErrors(state: AccountState): AccountFieldErrors {
  if (state.mode === "sign_up") return validateSignUp(state);
  const email = emailIssue(state.email);
  return email ? { email } : {};
}

export function accountReducer(state: AccountState, action: AccountAction): AccountState {
  switch (action.type) {
    case "opened":
      return { ...INITIAL_ACCOUNT_STATE, mode: action.mode };

    case "setMode":
      return { ...state, mode: action.mode, phase: "form", code: "", fieldErrors: {}, error: null };

    case "setField": {
      const { [action.field]: _cleared, ...fieldErrors } = state.fieldErrors;
      return { ...state, [action.field]: action.value, fieldErrors, error: null };
    }

    case "setMarketingOptIn":
      return { ...state, marketingOptIn: action.value };

    case "submitRejected":
      return { ...state, fieldErrors: action.fieldErrors };

    case "sendStarted":
      return { ...state, phase: "sending", fieldErrors: {}, error: null };

    case "codeSent":
      return { ...state, phase: "code", code: "", error: null };

    case "setCode":
      return { ...state, code: action.code.replace(/\D/g, ""), error: null };

    case "verifyStarted":
      return { ...state, phase: "verifying", error: null };

    case "verified":
      return { ...state, mode: action.mode ?? state.mode, phase: "done", code: "", error: null };

    case "providerStarted":
      return { ...state, phase: "connecting", fieldErrors: {}, error: null };

    // Closing the provider's screen is not a failure: back to the form, nothing to report.
    case "providerCanceled":
      return { ...state, phase: "form" };

    // A failed request returns to the step it came from, keeping what was typed.
    case "failed": {
      const cameFromForm = state.phase === "sending" || state.phase === "connecting";
      const phase = state.phase === "verifying" ? "code" : cameFromForm ? "form" : state.phase;
      return { ...state, phase, error: action.message };
    }

    case "editEmail":
      return { ...state, phase: "form", code: "", error: null };
  }
}
