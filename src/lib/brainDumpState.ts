import type { BrainDumpProposal } from "@domain/brainDump/types";
import { TASK_LIMITS } from "@domain/task";
import { Task, TaskDraft } from "./types";

// State machine behind the Brain Dump sheet, kept pure so every transition is
// unit-tested; useBrainDump only performs the network calls around it.

export type BrainDumpPhase = "input" | "interpreting" | "review" | "committing" | "done";

export interface EditableCandidate {
  included: boolean;
  draft: TaskDraft; // what will be sent to commit_brain_dump, including user edits
}

export interface BrainDumpError {
  message: string;
  retryable: boolean;
}

export interface BrainDumpState {
  phase: BrainDumpPhase;
  text: string;
  proposal: BrainDumpProposal | null;
  edits: EditableCandidate[]; // aligned by index with proposal.candidates
  createdTasks: Task[];
  error: BrainDumpError | null;
}

export type BrainDumpAction =
  | { type: "setText"; text: string }
  | { type: "submitStarted" }
  | { type: "proposalReceived"; proposal: BrainDumpProposal }
  | { type: "setIncluded"; index: number; included: boolean }
  | { type: "setTitle"; index: number; title: string }
  | { type: "commitStarted" }
  | { type: "committed"; tasks: Task[] }
  | { type: "failed"; error: BrainDumpError }
  | { type: "reset" };

export const INITIAL_BRAIN_DUMP_STATE: BrainDumpState = {
  phase: "input",
  text: "",
  proposal: null,
  edits: [],
  createdTasks: [],
  error: null,
};

export function brainDumpReducer(state: BrainDumpState, action: BrainDumpAction): BrainDumpState {
  switch (action.type) {
    case "setText":
      return { ...state, text: action.text, error: null };

    case "submitStarted":
      return { ...state, phase: "interpreting", error: null };

    case "proposalReceived": {
      const { proposal } = action;
      if (proposal.status === "committed") {
        return { ...state, phase: "done", proposal, edits: [], createdTasks: proposal.createdTasks };
      }
      return {
        ...state,
        phase: "review",
        proposal,
        // Everything starts selected except likely duplicates of pending tasks.
        edits: proposal.candidates.map((candidate) => ({
          included: candidate.possibleDuplicateOfTaskId === null,
          draft: candidate.draft,
        })),
      };
    }

    case "setIncluded":
      return { ...state, edits: updateAt(state.edits, action.index, (edit) => ({ ...edit, included: action.included })) };

    case "setTitle":
      return {
        ...state,
        edits: updateAt(state.edits, action.index, (edit) => ({
          ...edit,
          draft: { ...edit.draft, title: action.title.slice(0, TASK_LIMITS.titleMaxLength) },
        })),
      };

    case "commitStarted":
      return { ...state, phase: "committing", error: null };

    case "committed":
      return { ...state, phase: "done", createdTasks: action.tasks };

    case "failed":
      // Interpretation failures go back to the text so nothing typed is lost;
      // commit failures stay on the review so edits are kept.
      return { ...state, phase: state.phase === "committing" ? "review" : "input", error: action.error };

    case "reset":
      return INITIAL_BRAIN_DUMP_STATE;
  }
}

// Drafts the user kept, with trimmed titles; blank titles are dropped.
export function selectedDrafts(state: BrainDumpState): TaskDraft[] {
  return state.edits
    .filter((edit) => edit.included && edit.draft.title.trim().length > 0)
    .map((edit) => ({ ...edit.draft, title: edit.draft.title.trim() }));
}

function updateAt<T>(items: T[], index: number, update: (item: T) => T): T[] {
  return items.map((item, i) => (i === index ? update(item) : item));
}
