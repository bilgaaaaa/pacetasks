import type { BrainDumpCandidate, BrainDumpProposal } from "@domain/brainDump/types";
import { makeTask } from "@domain/testing/makeTask";
import { brainDumpReducer, INITIAL_BRAIN_DUMP_STATE, selectedDrafts } from "../brainDumpState";

function candidate(index: number, title: string, duplicateOf: string | null = null): BrainDumpCandidate {
  return {
    index,
    draft: { title, source: "brain_dump" },
    sourceSpan: title,
    dateText: null,
    confidence: 0.9,
    issues: [],
    possibleDuplicateOfTaskId: duplicateOf,
  };
}

function proposal(overrides: Partial<BrainDumpProposal> = {}): BrainDumpProposal {
  return {
    sessionId: "s1",
    status: "proposed",
    needsReview: true,
    reviewReasons: ["candidate_issues"],
    candidates: [candidate(0, "Chiamare il veterinario"), candidate(1, "Buy shampoo", "task-9")],
    unparsedFragments: [],
    detectedLanguages: ["it", "en"],
    createdTasks: [],
    ...overrides,
  };
}

describe("brainDumpReducer", () => {
  it("moves input → interpreting → review, deselecting likely duplicates", () => {
    let state = brainDumpReducer(INITIAL_BRAIN_DUMP_STATE, { type: "setText", text: "domani…" });
    state = brainDumpReducer(state, { type: "submitStarted" });
    expect(state.phase).toBe("interpreting");

    state = brainDumpReducer(state, { type: "proposalReceived", proposal: proposal() });
    expect(state.phase).toBe("review");
    expect(state.edits.map((e) => e.included)).toEqual([true, false]);
  });

  it("goes straight to done when the server already created the tasks", () => {
    const created = [makeTask({ id: "t1" })];
    const state = brainDumpReducer(INITIAL_BRAIN_DUMP_STATE, {
      type: "proposalReceived",
      proposal: proposal({ status: "committed", needsReview: false, createdTasks: created }),
    });
    expect(state.phase).toBe("done");
    expect(state.createdTasks).toBe(created);
  });

  it("applies edits and only commits selected, non-blank drafts with trimmed titles", () => {
    let state = brainDumpReducer(INITIAL_BRAIN_DUMP_STATE, { type: "proposalReceived", proposal: proposal() });
    state = brainDumpReducer(state, { type: "setTitle", index: 0, title: "  Chiamare il vet per Bruno  " });
    state = brainDumpReducer(state, { type: "setIncluded", index: 1, included: true });
    expect(selectedDrafts(state).map((d) => d.title)).toEqual(["Chiamare il vet per Bruno", "Buy shampoo"]);

    state = brainDumpReducer(state, { type: "setTitle", index: 1, title: "   " });
    expect(selectedDrafts(state)).toHaveLength(1);
    expect(selectedDrafts(state)[0].source).toBe("brain_dump");
  });

  it("keeps the text on interpretation errors and the edits on commit errors", () => {
    const error = { message: "Try again", retryable: true };
    let state = brainDumpReducer({ ...INITIAL_BRAIN_DUMP_STATE, text: "x", phase: "interpreting" }, { type: "failed", error });
    expect(state).toMatchObject({ phase: "input", text: "x", error });

    state = brainDumpReducer(state, { type: "proposalReceived", proposal: proposal() });
    state = brainDumpReducer(state, { type: "setTitle", index: 0, title: "edited" });
    state = brainDumpReducer(state, { type: "commitStarted" });
    state = brainDumpReducer(state, { type: "failed", error });
    expect(state.phase).toBe("review");
    expect(state.edits[0].draft.title).toBe("edited");
  });

  it("clears errors when the user edits the text, and reset starts over", () => {
    const failed = { ...INITIAL_BRAIN_DUMP_STATE, error: { message: "x", retryable: false } };
    expect(brainDumpReducer(failed, { type: "setText", text: "y" }).error).toBeNull();
    expect(brainDumpReducer(failed, { type: "reset" })).toBe(INITIAL_BRAIN_DUMP_STATE);
  });
});
