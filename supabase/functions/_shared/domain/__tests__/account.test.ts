import { emailIssue, isCompleteCode, normalizeEmail, validateSignUp } from "../account";

describe("account rules", () => {
  it("accepts a complete sign-up", () => {
    expect(validateSignUp({ firstName: "Bilge", lastName: "Özcan", email: " Bilge@Example.com " })).toEqual({});
  });

  it("reports every field that is missing, too long or not an email", () => {
    expect(validateSignUp({ firstName: "  ", lastName: "x".repeat(51), email: "bilge@example" })).toEqual({
      firstName: "required",
      lastName: "too_long",
      email: "invalid",
    });
    expect(emailIssue("")).toBe("required");
    expect(emailIssue("two words@example.com")).toBe("invalid");
  });

  it("normalizes emails so the same address always matches", () => {
    expect(normalizeEmail("  Bilge@Example.COM ")).toBe("bilge@example.com");
  });

  it("recognizes a complete code", () => {
    expect(isCompleteCode("123456")).toBe(true);
    expect(isCompleteCode("12345678")).toBe(true); // the project may send 6 to 10 digits
    expect(isCompleteCode("1234567890")).toBe(true);
    expect(isCompleteCode("12345678901")).toBe(false);
    expect(isCompleteCode("12345")).toBe(false);
    expect(isCompleteCode("12345a")).toBe(false);
  });
});
