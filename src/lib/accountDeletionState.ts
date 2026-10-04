// State machine behind the "delete account" sheet, kept pure so every transition
// is unit-tested; useAccount only performs the network call around it.

export type AccountDeletionPhase = "closed" | "confirming" | "deleting" | "deleted";

export interface AccountDeletionState {
  phase: AccountDeletionPhase;
  userId: string | null; // whose data the sheet asked about; a different user must never be deleted in their place
  hasAccount: boolean; // a signed-up account, or only this phone's anonymous data; fixed when the sheet opens
  error: string | null; // user-facing message from a failed deletion
}

export type AccountDeletionAction =
  | { type: "opened"; userId: string; hasAccount: boolean }
  | { type: "deleteStarted" }
  | { type: "deleted" }
  | { type: "failed"; message: string }
  | { type: "closed" };

export const INITIAL_ACCOUNT_DELETION_STATE: AccountDeletionState = {
  phase: "closed",
  userId: null,
  hasAccount: false,
  error: null,
};

export function accountDeletionReducer(
  state: AccountDeletionState,
  action: AccountDeletionAction
): AccountDeletionState {
  switch (action.type) {
    case "opened":
      return { phase: "confirming", userId: action.userId, hasAccount: action.hasAccount, error: null };

    case "deleteStarted":
      return state.phase === "confirming" ? { ...state, phase: "deleting", error: null } : state;

    case "deleted":
      return state.phase === "deleting" ? { ...state, phase: "deleted" } : state;

    // A failed deletion returns to the question, so the user can try again or cancel.
    case "failed":
      return state.phase === "deleting" ? { ...state, phase: "confirming", error: action.message } : state;

    // The sheet can't be dismissed mid-request: the outcome must be seen. The
    // wording (hasAccount) is kept so it doesn't change while the sheet slides away.
    case "closed":
      return state.phase === "deleting" ? state : { ...INITIAL_ACCOUNT_DELETION_STATE, hasAccount: state.hasAccount };
  }
}
