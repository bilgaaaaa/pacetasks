import { emailIssue, isCompleteCode, normalizeEmail, suggestEmail, validateSignUp } from "../account";

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

describe("suggestEmail", () => {
  it("fixes a mistyped well-known provider, keeping the name as typed", () => {
    expect(suggestEmail("bilgeozcanbaz@icould.com")).toBe("bilgeozcanbaz@icloud.com"); // a real bounce
    expect(suggestEmail(" Bilge@GMIAL.com ")).toBe("bilge@gmail.com");
    expect(suggestEmail("bilge@gmail.con")).toBe("bilge@gmail.com");
    expect(suggestEmail("bilge@hotmial.it")).toBe("bilge@hotmail.it");
    expect(suggestEmail("bilge@outlok.com")).toBe("bilge@outlook.com");
    expect(suggestEmail("bilge@yahooo.com")).toBe("bilge@yahoo.com");
  });

  it("leaves correct, unknown and incomplete addresses alone", () => {
    expect(suggestEmail("bilge@icloud.com")).toBeNull();
    expect(suggestEmail("bilge@mail.com")).toBeNull(); // a real provider one letter from gmail.com
    expect(suggestEmail("bilge@me.com")).toBeNull();
    expect(suggestEmail("bilge@pacetasks.app")).toBeNull();
    expect(suggestEmail("bilge@icloud")).toBeNull(); // not an email yet: the form says so instead
    expect(suggestEmail("")).toBeNull();
  });

  it("allows one slip in a short domain and two in a long one", () => {
    expect(suggestEmail("bilge@yaho.it")).toBe("bilge@yahoo.it");
    expect(suggestEmail("bilge@yho.it")).toBeNull(); // two slips in an eight-letter domain is a different address
    expect(suggestEmail("bilge@gmal.co")).toBe("bilge@gmail.com");
  });
});
