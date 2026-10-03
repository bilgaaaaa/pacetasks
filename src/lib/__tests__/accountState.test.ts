import { accountReducer, AccountState, formErrors, INITIAL_ACCOUNT_STATE } from "../accountState";

const filled: AccountState = {
  ...INITIAL_ACCOUNT_STATE,
  firstName: "Bilge",
  lastName: "Ozcan",
  email: "bilge@example.com",
};

describe("accountState", () => {
  it("starts on an empty sign-up form with consent off", () => {
    expect(accountReducer(filled, { type: "opened", mode: "sign_up" })).toEqual(INITIAL_ACCOUNT_STATE);
    expect(INITIAL_ACCOUNT_STATE.marketingOptIn).toBe(false);
  });

  it("validates names only when signing up", () => {
    const empty = { ...INITIAL_ACCOUNT_STATE, email: "bilge@example.com" };

    expect(formErrors(empty)).toEqual({ firstName: "required", lastName: "required" });
    expect(formErrors({ ...empty, mode: "sign_in" })).toEqual({});
    expect(formErrors({ ...empty, mode: "sign_in", email: "nope" })).toEqual({ email: "invalid" });
  });

  it("clears a field's error as soon as it is edited", () => {
    const rejected = accountReducer(filled, { type: "submitRejected", fieldErrors: { email: "invalid", firstName: "required" } });
    const edited = accountReducer(rejected, { type: "setField", field: "email", value: "b@example.com" });

    expect(edited.fieldErrors).toEqual({ firstName: "required" });
    expect(edited.email).toBe("b@example.com");
  });

  it("walks from the form to the code to done", () => {
    let state = accountReducer(filled, { type: "sendStarted" });
    expect(state.phase).toBe("sending");

    state = accountReducer(state, { type: "codeSent" });
    expect(state.phase).toBe("code");

    state = accountReducer(state, { type: "setCode", code: "12 34-56" });
    expect(state.code).toBe("123456");

    state = accountReducer(state, { type: "verifyStarted" });
    state = accountReducer(state, { type: "verified" });
    expect(state.phase).toBe("done");
  });

  it("returns to the step a failed request came from, keeping what was typed", () => {
    const sending = accountReducer(filled, { type: "sendStarted" });
    expect(accountReducer(sending, { type: "failed", message: "x" })).toMatchObject({
      phase: "form",
      error: "x",
      email: "bilge@example.com",
    });

    const verifying = accountReducer({ ...filled, phase: "code", code: "123456" }, { type: "verifyStarted" });
    expect(accountReducer(verifying, { type: "failed", message: "wrong" })).toMatchObject({
      phase: "code",
      error: "wrong",
      code: "123456",
    });
  });

  it("stays on the code step when asking for a new code fails", () => {
    const inCode: AccountState = { ...filled, phase: "code", code: "12" };

    expect(accountReducer(inCode, { type: "failed", message: "wait" })).toMatchObject({ phase: "code", error: "wait" });
  });

  it("keeps the details when switching mode or going back to change the email", () => {
    const inCode: AccountState = { ...filled, phase: "code", code: "12" };

    expect(accountReducer(inCode, { type: "editEmail" })).toMatchObject({ phase: "form", code: "", firstName: "Bilge" });
    expect(accountReducer(inCode, { type: "setMode", mode: "sign_in" })).toMatchObject({
      mode: "sign_in",
      phase: "form",
      email: "bilge@example.com",
    });
  });
});
