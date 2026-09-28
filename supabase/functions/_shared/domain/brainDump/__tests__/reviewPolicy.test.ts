import { decideReview } from "../reviewPolicy";
import type { BrainDumpCandidate } from "../types";

function candidate(index: number, withIssue = false): BrainDumpCandidate {
  return {
    index,
    draft: { title: `task ${index}` },
    sourceSpan: `task ${index}`,
    dateText: null,
    confidence: 0.9,
    issues: withIssue ? [{ code: "ambiguous", field: null, message: "?" }] : [],
    possibleDuplicateOfTaskId: null,
  };
}

describe("decideReview", () => {
  it("allows automatic creation only for clean, small results", () => {
    expect(decideReview([candidate(0), candidate(1)], [])).toEqual({ needsReview: false, reasons: [] });
  });

  it("requires review for issues, empty results, too many tasks or leftover text", () => {
    expect(decideReview([candidate(0, true)], []).reasons).toEqual(["candidate_issues"]);
    expect(decideReview([], []).reasons).toEqual(["no_candidates"]);
    expect(decideReview(Array.from({ length: 9 }, (_, i) => candidate(i)), []).reasons).toEqual([
      "too_many_candidates",
    ]);
    expect(decideReview([candidate(0)], ["boh"]).reasons).toEqual(["unparsed_text"]);
  });
});
