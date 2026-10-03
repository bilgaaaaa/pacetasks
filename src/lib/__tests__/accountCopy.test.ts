import { codePrompt, doneMessage, fieldErrorLabel, sheetTitle, switchModeLabel } from "../accountCopy";

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
    expect(codePrompt("bilge@example.com")).toBe("Enter the 6-digit code we sent to bilge@example.com.");
    expect(doneMessage("sign_up", "Bilge")).toBe("You're all set, Bilge.");
    expect(doneMessage("sign_in", null)).toBe("Welcome back.");
  });
});
