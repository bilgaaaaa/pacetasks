import {
  accountDeletionReducer,
  AccountDeletionState,
  INITIAL_ACCOUNT_DELETION_STATE,
} from "../accountDeletionState";

const confirming: AccountDeletionState = { phase: "confirming", userId: "user-1", hasAccount: true, error: null };
const deleting: AccountDeletionState = { ...confirming, phase: "deleting" };

describe("accountDeletionState", () => {
  it("starts closed and opens on the question, remembering what is being deleted", () => {
    expect(INITIAL_ACCOUNT_DELETION_STATE.phase).toBe("closed");
    expect(
      accountDeletionReducer(INITIAL_ACCOUNT_DELETION_STATE, { type: "opened", userId: "user-1", hasAccount: true })
    ).toEqual(confirming);
  });

  it("walks from the question to deleting to deleted", () => {
    const started = accountDeletionReducer(confirming, { type: "deleteStarted" });
    expect(started.phase).toBe("deleting");
    expect(accountDeletionReducer(started, { type: "deleted" }).phase).toBe("deleted");
  });

  it("returns to the question with the message when the deletion fails", () => {
    expect(accountDeletionReducer(deleting, { type: "failed", message: "No connection" })).toEqual({
      ...confirming,
      error: "No connection",
    });
  });

  it("clears an earlier error when opened or retried", () => {
    const failed = { ...confirming, error: "No connection" };
    expect(accountDeletionReducer(failed, { type: "deleteStarted" }).error).toBeNull();
    expect(accountDeletionReducer(failed, { type: "opened", userId: "user-1", hasAccount: false }).error).toBeNull();
  });

  it("cannot be closed or restarted while the deletion is running", () => {
    expect(accountDeletionReducer(deleting, { type: "closed" })).toBe(deleting);
    expect(accountDeletionReducer(deleting, { type: "deleteStarted" })).toBe(deleting);
  });

  it("ignores a result that arrives when nothing is being deleted", () => {
    expect(accountDeletionReducer(confirming, { type: "deleted" })).toBe(confirming);
    expect(accountDeletionReducer(confirming, { type: "failed", message: "x" })).toBe(confirming);
  });

  it("closes from the question and from the result, keeping the wording stable while the sheet slides away", () => {
    expect(accountDeletionReducer(confirming, { type: "closed" })).toEqual({
      phase: "closed",
      userId: null,
      hasAccount: true,
      error: null,
    });
    expect(accountDeletionReducer({ ...confirming, phase: "deleted" }, { type: "closed" }).phase).toBe("closed");
  });
});
