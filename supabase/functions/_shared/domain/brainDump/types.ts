import type { Task, TaskDraft } from "../task.ts";

// Why a candidate needs the user's eye before it becomes a task.
export type CandidateIssueCode =
  | "low_confidence"
  | "ambiguous"
  | "date_unresolved"
  | "date_in_past"
  | "title_truncated"
  | "unknown_category"
  | "possible_duplicate";

export interface CandidateIssue {
  code: CandidateIssueCode;
  field: string | null;
  message: string; // English, for logs and a fallback label; the UI maps codes to copy
}

// One interpreted task, ready for review. `draft` is exactly what gets passed
// to create_task on commit, so the review screen edits the draft directly.
export interface BrainDumpCandidate {
  index: number;
  draft: TaskDraft;
  sourceSpan: string; // the part of the user's text this came from
  dateText: string | null; // e.g. "domani", shown next to the resolved date
  confidence: number;
  issues: CandidateIssue[];
  possibleDuplicateOfTaskId: string | null;
}

export type ReviewReason =
  | "no_candidates"
  | "candidate_issues"
  | "too_many_candidates"
  | "unparsed_text";

export type BrainDumpStatus = "proposed" | "committed";

// What the brain-dump Edge Function returns to the app, Siri and Shortcuts.
export interface BrainDumpProposal {
  sessionId: string;
  status: BrainDumpStatus;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  candidates: BrainDumpCandidate[];
  unparsedFragments: string[];
  detectedLanguages: string[];
  createdTasks: Task[]; // filled only when the proposal was auto-committed
}
