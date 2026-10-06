import {
  accountEmailLabel,
  appleHint,
  codePrompt,
  deletionConfirmLabel,
  deletionConsequences,
  deletionDoneMessage,
  deletionEntryLabel,
  deletionIntro,
  deletionTitle,
  doneMessage,
  fieldErrorLabel,
  sheetTitle,
  switchModeLabel,
} from "../accountCopy";

describe("accountCopy", () => {
  it("says what to fix in a field", () => {
    expect(fieldErrorLabel("firstName", "required")).toBe("First name is needed");
    expect(fieldErrorLabel("lastName", "too_long")).toBe("Keep it under 50 characters");
    expect(fieldErrorLabel("email", "invalid")).toBe("That doesn't look like an email address");
  });

  it("words the sheet for each mode", () => {
    expect(sheetTitle("sign_up")).toBe("Create your account");
    expect(sheetTitle("sign_in")).toBe("Welcome back");
    expect(switchModeLabel("sign_up")).toBe("I already have an account");
  });

  it("names the email the code went to and greets by first name", () => {
    expect(codePrompt("bilge@example.com")).toBe("Enter the code we sent to bilge@example.com.");
    expect(doneMessage("sign_up", "Bilge")).toBe("You're all set, Bilge.");
    expect(doneMessage("sign_in", null)).toBe("Welcome back.");
  });

  it("explains what the Apple button does to this phone's tasks in each mode", () => {
    expect(appleHint("sign_up")).toMatch(/tasks stay with you/);
    expect(appleHint("sign_in")).toMatch(/^Opens the account made with your Apple ID\./);
    expect(appleHint("sign_in")).toMatch(/creates one/); // signing in with a new Apple ID makes an account, so it says so
  });

  it("shows the account's email, without exposing Apple's relay address", () => {
    expect(accountEmailLabel("bilge@example.com")).toBe("bilge@example.com");
    expect(accountEmailLabel("abc123@privaterelay.appleid.com")).toBe("Signed in with Apple (email hidden)");
    expect(accountEmailLabel(null)).toBe("Signed in");
  });

  it("words the deletion for an account and for a phone without one", () => {
    expect(deletionEntryLabel(true)).toBe("Delete account");
    expect(deletionEntryLabel(false)).toBe("Delete my data");
    expect(deletionTitle(true)).toBe("Delete your account?");
    expect(deletionConfirmLabel(false)).toBe("Delete my data");
    expect(deletionDoneMessage(true)).toBe("Your account is deleted.");
    expect(deletionIntro(true)).toMatch(/every phone/);
    expect(deletionIntro(false)).toMatch(/this phone/);
  });

  it("only lists the account itself as going when there is one", () => {
    expect(deletionConsequences(true)[0]).toBe("Your account, with your name and email");
    expect(deletionConsequences(false)).toHaveLength(deletionConsequences(true).length - 1);
    expect(deletionConsequences(false).join(" ")).not.toMatch(/account|email/);
  });
});
