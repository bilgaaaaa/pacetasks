import { addButtonLabel, issueLabel, reviewSummary } from "../brainDumpCopy";

describe("brainDumpCopy", () => {
  it("labels issues, using the AI's reason for ambiguities", () => {
    expect(issueLabel({ code: "possible_duplicate", field: "title", message: "x" })).toBe("Already on your list");
    expect(issueLabel({ code: "ambiguous", field: "flexible", message: "Depends on energy" })).toBe(
      "Check: Depends on energy"
    );
  });

  it("summarizes the review", () => {
    expect(reviewSummary(0, ["no_candidates"])).toMatch(/couldn't find any tasks/);
    expect(reviewSummary(3, ["candidate_issues"])).toBe("3 tasks. Check the highlighted ones before adding.");
    expect(reviewSummary(1, [])).toBe("1 task, ready to add.");
  });

  it("pluralizes the add button", () => {
    expect(addButtonLabel(0)).toBe("Nothing selected");
    expect(addButtonLabel(1)).toBe("Add 1 task");
    expect(addButtonLabel(4)).toBe("Add 4 tasks");
  });
});
