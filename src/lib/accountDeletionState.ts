// State machine behind the "delete account" sheet, kept pure so every transition
// is unit-tested; useAccount only performs the network call around it.

export type AccountDeletionPhase = "closed" | "confirming" | "deleting" | "deleted";

export interface AccountDeletionState {
  phase: AccountDeletionPhase;
  hasAccount: boolean; // whether a signed-up account (not just this phone's data) is being deleted; fixed when the sheet opens
  error: string | null; // user-facing message from a failed deletion
}

export type AccountDeletionAction =
  | { type: "opened"; hasAccount: boolean }
  | { type: "deleteStarted" }
  | { type: "deleted" }
  | { type: "failed"; message: string }
  | { type: "closed" };

export const INITIAL_ACCOUNT_DELETION_STATE: AccountDeletionState = {
  phase: "closed",
  hasAccount: false,
  error: null,
};

export function accountDeletionReducer(
  state: AccountDeletionState,
  action: AccountDeletionAction
): AccountDeletionState {
  switch (action.type) {
    case "opened":
      return { phase: "confirming", hasAccount: action.hasAccount, error: null };

    case "deleteStarted":
      return state.phase === "confirming" ? { ...state, phase: "deleting", error: null } : state;

    case "deleted":
      return state.phase === "deleting" ? { ...state, phase: "deleted" } : state;

    // A failed deletion returns to the question, so the user can try again or cancel.
    case "failed":
      return state.phase === "deleting" ? { ...state, phase: "confirming", error: action.message } : state;

    // The sheet can't be dismissed mid-request: the outcome must be seen.
    case "closed":
      return state.phase === "deleting" ? state : { ...INITIAL_ACCOUNT_DELETION_STATE, hasAccount: state.hasAccount };
  }
}
