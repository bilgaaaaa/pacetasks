import { emailIssue, suggestEmail, validateSignUp } from "@domain/account";
import type { AccountField, AccountFieldErrors } from "@domain/account";
import type { AccountMode } from "./accountApi";

// State machine behind the account sheet, kept pure so every transition is
// unit-tested; useAccount only performs the network calls around it.

export type AccountPhase = "form" | "sending" | "code" | "verifying" | "done";

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
  emailSuggestion: string | null; // likely fix for a mistyped email, asked about once before sending
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
  | { type: "verified" }
  | { type: "failed"; message: string }
  | { type: "editEmail" }
  | { type: "emailSuggested"; suggestion: string }
  | { type: "emailSuggestionAccepted" };

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
  emailSuggestion: null,
};

// What is wrong with the form for the current mode; signing in only needs the email.
export function formErrors(state: AccountState): AccountFieldErrors {
  if (state.mode === "sign_up") return validateSignUp(state);
  const email = emailIssue(state.email);
  return email ? { email } : {};
}

// A fix to offer before sending, or null once the user was asked about this email,
// so a second tap sends the address exactly as typed.
export function emailSuggestionToAsk(state: AccountState): string | null {
  return state.emailSuggestion ? null : suggestEmail(state.email);
}

export function accountReducer(state: AccountState, action: AccountAction): AccountState {
  switch (action.type) {
    case "opened":
      return { ...INITIAL_ACCOUNT_STATE, mode: action.mode };

    case "setMode":
      return { ...state, mode: action.mode, phase: "form", code: "", fieldErrors: {}, error: null, emailSuggestion: null };

    case "setField": {
      const { [action.field]: _cleared, ...fieldErrors } = state.fieldErrors;
      const emailSuggestion = action.field === "email" ? null : state.emailSuggestion;
      return { ...state, [action.field]: action.value, fieldErrors, error: null, emailSuggestion };
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
      return { ...state, phase: "done", code: "", error: null };

    // A failed request returns to the step it came from, keeping what was typed.
    case "failed": {
      const phase = state.phase === "verifying" ? "code" : state.phase === "sending" ? "form" : state.phase;
      return { ...state, phase, error: action.message };
    }

    case "editEmail":
      return { ...state, phase: "form", code: "", error: null };

    case "emailSuggested":
      return { ...state, emailSuggestion: action.suggestion };

    // Also reachable from the code step, where a code sent to a mistyped address never arrives.
    case "emailSuggestionAccepted": {
      if (!state.emailSuggestion || (state.phase !== "form" && state.phase !== "code")) return state;
      const { email: _cleared, ...fieldErrors } = state.fieldErrors;
      return {
        ...state,
        phase: "form",
        email: state.emailSuggestion,
        emailSuggestion: null,
        code: "",
        fieldErrors,
        error: null,
      };
    }
  }
}
