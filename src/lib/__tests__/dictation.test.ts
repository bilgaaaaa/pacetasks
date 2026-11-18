import {
  applyDictationResult,
  dictatedText,
  dictationErrorMessage,
  EMPTY_TRANSCRIPT,
} from "../dictation";

describe("applyDictationResult", () => {
  it("replaces the unfinished phrase and keeps the finished ones", () => {
    let transcript = applyDictationResult(EMPTY_TRANSCRIPT, "call the", false);
    transcript = applyDictationResult(transcript, "call the vet", false);
    expect(transcript).toEqual({ committed: "", interim: "call the vet" });
    transcript = applyDictationResult(transcript, "Call the vet.", true);
    transcript = applyDictationResult(transcript, "buy", false);
    expect(transcript).toEqual({ committed: "Call the vet.", interim: "buy" });
    expect(applyDictationResult(transcript, "Buy milk.", true).committed).toBe("Call the vet. Buy milk.");
  });
});

describe("dictatedText", () => {
  it("adds what was heard after what was typed", () => {
    expect(dictatedText("Laundry,", { committed: "Call the vet.", interim: "buy" }, 100)).toBe("Laundry, Call the vet. buy");
    expect(dictatedText("", { committed: "", interim: "hello" }, 100)).toBe("hello");
    expect(dictatedText("Laundry", EMPTY_TRANSCRIPT, 100)).toBe("Laundry");
  });

  it("stays inside the field's limit", () => {
    expect(dictatedText("", { committed: "one two three", interim: "" }, 7)).toBe("one two");
  });
});

describe("dictationErrorMessage", () => {
  it("says nothing when the user stopped or stayed silent", () => {
    expect(dictationErrorMessage("aborted")).toBeNull();
    expect(dictationErrorMessage("no-speech")).toBeNull();
  });

  it("points to Settings when permission is off", () => {
    expect(dictationErrorMessage("not-allowed")).toContain("iPhone Settings");
  });
});
